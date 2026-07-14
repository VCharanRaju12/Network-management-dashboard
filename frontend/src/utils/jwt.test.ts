import { describe, it, expect } from "vitest";
import { base64UrlDecode, decodeToken } from "./jwt";

// Helper: builds a fake (unsigned) JWT with a given payload, the same shape
// our real backend issues (header.payload.signature), using true base64url
// encoding — exactly what a real token looks like.
function makeFakeToken(payload: object): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode(header)}.${encode(payload)}.fake-signature`;
}

describe("base64UrlDecode", () => {
  it("decodes standard base64url input", () => {
    const encoded = btoa("hello world").replace(/\+/g, "-").replace(/\//g, "_");
    expect(base64UrlDecode(encoded)).toBe("hello world");
  });

  it("handles input missing padding (the real-world JWT case)", () => {
    // Regression test: this is the exact bug that shipped and silently broke
    // the "Add device" button for admins. atob() alone chokes on unpadded
    // base64url strings containing '-'/'_' — this must not throw, and must
    // decode to the correct original string.
    const original = "a string long enough to need padding characters";
    const base64 = btoa(original);
    const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(() => base64UrlDecode(base64url)).not.toThrow();
    expect(base64UrlDecode(base64url)).toBe(original);
  });
});

describe("decodeToken", () => {
  it("extracts role, sub, and exp from a valid token payload", () => {
    const token = makeFakeToken({
      sub: "7d5c6b99-27a9-49cb-94a6-24edcfe1006b",
      role: "admin",
      type: "access",
      exp: 1783406357,
    });
    const decoded = decodeToken(token);
    expect(decoded.role).toBe("admin");
    expect(decoded.sub).toBe("7d5c6b99-27a9-49cb-94a6-24edcfe1006b");
    expect(decoded.exp).toBe(1783406357);
  });

  it("returns nulls (not a throw) for a malformed token", () => {
    const decoded = decodeToken("not-a-real-jwt");
    expect(decoded.role).toBeNull();
    expect(decoded.sub).toBeNull();
    expect(decoded.exp).toBeNull();
  });

  it("returns nulls for an empty string", () => {
    const decoded = decodeToken("");
    expect(decoded.role).toBeNull();
  });
});
