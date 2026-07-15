const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

let refreshInFlight: Promise<string | null> | null = null;

// Attempts to silently trade the refresh_token for a new access_token.
// De-duplicated via refreshInFlight so multiple 401s at once (e.g. several
// requests in flight when the token expires) only trigger one refresh call.
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return data.access_token as string;
    } catch {
      return null;
    }
  })();

  const result = await refreshInFlight;
  refreshInFlight = null;
  return result;
}

function clearSessionAndNotify() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("username");
  // AuthContext listens for this to update React state / redirect to login —
  // client.ts can't import AuthContext directly (would create a cycle).
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && !isRetry && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, true);
    }
    clearSessionAndNotify();
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(typeof detail === "string" ? detail : "Request failed", res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export interface Device {
  id: string;
  name: string;
  ip_address: string;
  device_type: string;
  vendor: string | null;
  status: "online" | "offline" | "unknown" | "degraded" | string;
  poll_interval_seconds: number;
  created_at: string;
}

export interface Metric {
  metric_type: string;
  value: number;
  recorded_at: string;
}

export interface InterfaceDetail {
  id: string;
  if_name: string;
  if_index: number | null;
  is_up: boolean;
  speed_mbps: number | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface DeviceEvent {
  id: number;
  device_id: string | null;
  device_name: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export const api = {
  login: (username: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  refresh: (refreshToken: string) =>
    request<TokenResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  listDevices: () => request<Device[]>("/devices"),

  getDevice: (id: string) => request<Device>(`/devices/${id}`),

  getDeviceMetrics: (id: string, limit = 200) =>
    request<Metric[]>(`/devices/${id}/metrics?limit=${limit}`),

  getDeviceInterfaces: (id: string) => request<InterfaceDetail[]>(`/devices/${id}/interfaces`),

  getRecentEvents: (limit = 30) => request<DeviceEvent[]>(`/devices/events/recent?limit=${limit}`),

  getAuditLog: (offset = 0, limit = 25) =>
    request<AuditLogEntry[]>(`/audit-log?offset=${offset}&limit=${limit}`),

  createDevice: (payload: {
    name: string;
    ip_address: string;
    device_type: string;
    snmp_community?: string;
    poll_interval_seconds?: number;
  }) =>
    request<Device>("/devices", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateDevice: (
    id: string,
    payload: Partial<{
      name: string;
      vendor: string;
      snmp_community: string;
      poll_interval_seconds: number;
    }>
  ) =>
    request<Device>(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteDevice: (id: string) => request<void>(`/devices/${id}`, { method: "DELETE" }),

  // User management (admin only — backend enforces this regardless of UI)
  listUsers: (offset = 0, limit = 20) => request<AppUser[]>(`/users?offset=${offset}&limit=${limit}`),

  createUser: (payload: { username: string; email: string; password: string; role: string }) =>
    request<AppUser>("/users", { method: "POST", body: JSON.stringify(payload) }),

  updateUser: (id: string, payload: Partial<{ role: string; is_active: boolean }>) =>
    request<AppUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteUser: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
};
