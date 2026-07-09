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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

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

export const api = {
  login: (username: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  listDevices: () => request<Device[]>("/devices"),

  getDevice: (id: string) => request<Device>(`/devices/${id}`),

  getDeviceMetrics: (id: string, limit = 200) =>
    request<Metric[]>(`/devices/${id}/metrics?limit=${limit}`),

  getRecentEvents: (limit = 30) => request<DeviceEvent[]>(`/devices/events/recent?limit=${limit}`),

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

  deleteDevice: (id: string) => request<void>(`/devices/${id}`, { method: "DELETE" }),
};
