import { createHmac, timingSafeEqual } from "node:crypto";

// Simple single-operator password gate (D6). No user table, no roles.
// The session cookie holds an HMAC of a fixed payload keyed by the password,
// so it can't be forged without knowing the password and is invalidated if the
// password changes. Proxy (Node runtime) + Server Actions both run this.

export const SESSION_COOKIE = "la_session";

function password(): string {
  const pw = process.env.LOST_ASTRONAUT_PASSWORD;
  if (!pw) throw new Error("LOST_ASTRONAUT_PASSWORD is not set");
  return pw;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function sessionToken(): string {
  return createHmac("sha256", password())
    .update("lost-astronaut-session")
    .digest("hex");
}

export function checkPassword(input: string): boolean {
  try {
    return safeEqual(input, password());
  } catch {
    return false;
  }
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    return safeEqual(token, sessionToken());
  } catch {
    return false;
  }
}
