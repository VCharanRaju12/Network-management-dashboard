import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

interface AuthState {
  isAuthenticated: boolean;
  role: string | null;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// Client-side JWT decoding is ONLY for display purposes (e.g. showing the
// user's role in the UI so we can hide admin-only buttons). The backend is
// the real source of truth — it independently verifies the token on every
// request, so nothing security-relevant depends on this decode.
//
// JWTs are base64URL-encoded (using "-" and "_" instead of "+" and "/", with
// padding stripped) — NOT plain base64. Passing that straight into atob()
// either throws or silently produces garbage on any token whose payload
// happens to contain those characters, which was quietly breaking role
// detection (and therefore hiding the "Add device" button for admins).
function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return atob(base64);
}

function decodeRole(token: string): { role: string | null; sub: string | null } {
  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1]));
    return { role: payload.role ?? null, sub: payload.sub ?? null };
  } catch {
    return { role: null, sub: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("access_token"));
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      const decoded = decodeRole(token);
      setRole(decoded.role);
      setUsername(localStorage.getItem("username"));
    } else {
      setRole(null);
      setUsername(null);
    }
  }, [token]);

  async function login(usernameInput: string, password: string) {
    const response = await api.login(usernameInput, password);
    localStorage.setItem("access_token", response.access_token);
    localStorage.setItem("refresh_token", response.refresh_token);
    localStorage.setItem("username", usernameInput);
    setToken(response.access_token);
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: !!token, role, username, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
