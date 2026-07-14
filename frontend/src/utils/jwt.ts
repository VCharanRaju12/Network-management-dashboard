/**
 * Client-side JWT decoding is ONLY for display purposes (e.g. showing the
 * user's role in the UI so we can hide admin-only buttons). The backend is
 * the real source of truth — it independently verifies the token on every
 * request, so nothing security-relevant depends on this decode.
 *
 * JWTs are base64URL-encoded (using "-" and "_" instead of "+" and "/", with
 * padding stripped) — NOT plain base64. Passing that straight into atob()
 * either throws or silently produces garbage on any token whose payload
 * happens to contain those characters. This bit us for real during
 * development (the "Add device" button silently disappeared for admins
 * whenever a token happened to contain one of those characters) — see the
 * test file for a regression test covering exactly that case.
 */
export function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return atob(base64);
}

export interface DecodedTokenInfo {
  role: string | null;
  sub: string | null;
  exp: number | null;
}

export function decodeToken(token: string): DecodedTokenInfo {
  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1]));
    return {
      role: payload.role ?? null,
      sub: payload.sub ?? null,
      exp: typeof payload.exp === "number" ? payload.exp : null,
    };
  } catch {
    return { role: null, sub: null, exp: null };
  }
}
