import { cookies } from "next/headers";
import crypto from "crypto";

type ConsoleCookiePayload = {
  email: string;
  apiKey?: string;
  ts: number; // issued at (ms)
};

const COOKIE_NAME = "console_auth";
const COOKIE_MAX_AGE_SEC = 5 * 60; // 5 minutes

function getSecret(): string {
  return process.env.CONSOLE_AUTH_COOKIE_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
}

function b64url(input: Buffer | string): string {
  const base = (input instanceof Buffer ? input : Buffer.from(input))
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return base;
}

function sign(data: string): string {
  const h = crypto.createHmac("sha256", getSecret());
  h.update(data);
  return b64url(h.digest());
}

export function createConsoleCookie(email: string, apiKey?: string) {
  const payload: ConsoleCookiePayload = { email, apiKey, ts: Date.now() };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body);
  const value = `v1.${body}.${sig}`;

  const isSecure = (process.env.NEXTAUTH_URL || "").startsWith("https://");
  cookies().set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}

export function readConsoleCookie(): { email: string; apiKey?: string } | null {
  const c = cookies().get(COOKIE_NAME)?.value;
  if (!c) return null;
  const parts = c.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [_, body, sig] = parts;
  const expected = sign(body);
  if (sig !== expected) return null;
  try {
    const json = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as ConsoleCookiePayload;
    // Expiry check (tolerate small clock skew)
    if (Date.now() - json.ts > COOKIE_MAX_AGE_SEC * 1000) return null;
    return { email: json.email, apiKey: json.apiKey };
  } catch {
    return null;
  }
}

export function clearConsoleCookie() {
  cookies().delete(COOKIE_NAME);
}


