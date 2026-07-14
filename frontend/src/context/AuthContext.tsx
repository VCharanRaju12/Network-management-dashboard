import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { decodeToken } from "../utils/jwt";

interface AuthState {
  isAuthenticated: boolean;
  role: string | null;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// Refresh this many seconds before the access token actually expires, so
// there's comfortable margin for the request itself plus any clock skew.
const REFRESH_MARGIN_SECONDS = 60;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("access_token"));
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function logout() {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
    setToken(null);
  }

  async function silentlyRefresh() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      logout();
      return;
    }
    try {
      const response = await api.refresh(refreshToken);
      localStorage.setItem("access_token", response.access_token);
      localStorage.setItem("refresh_token", response.refresh_token);
      setToken(response.access_token);
    } catch {
      // Refresh token itself expired/invalid — nothing to do but log out.
      logout();
    }
  }

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!token) {
      setRole(null);
      setUsername(null);
      return;
    }

    const decoded = decodeToken(token);
    setRole(decoded.role);
    setUsername(localStorage.getItem("username"));

    // Schedule a silent refresh shortly before this token expires, so an
    // active session never gets abruptly logged out mid-use.
    if (decoded.exp) {
      const msUntilExpiry = decoded.exp * 1000 - Date.now();
      const msUntilRefresh = Math.max(msUntilExpiry - REFRESH_MARGIN_SECONDS * 1000, 0);
      refreshTimerRef.current = setTimeout(silentlyRefresh, msUntilRefresh);
    }

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // The API client dispatches this when a request gets a 401 and the
  // refresh_token itself turns out to be invalid/expired too — the only
  // remaining option at that point is a full logout back to the login page.
  useEffect(() => {
    function handleSessionExpired() {
      logout();
    }
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  async function login(usernameInput: string, password: string) {
    const response = await api.login(usernameInput, password);
    localStorage.setItem("access_token", response.access_token);
    localStorage.setItem("refresh_token", response.refresh_token);
    localStorage.setItem("username", usernameInput);
    setToken(response.access_token);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, role, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
