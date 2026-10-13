import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureDatabase } from "./db";

export const SESSION_COOKIE = "kasir_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return ["GET", "HEAD", "OPTIONS"].includes(request.method);
  return origin === new URL(request.url).origin;
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db, user, response) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), user.id, expiresAt]
  );
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length !== 64) return null;
  const db = await ensureDatabase();
  const result = await db.query(
    `SELECT users.id, users.username, users.role
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
    [hashToken(token)]
  );
  return result.rows[0] || null;
}

export async function requireUser(request) {
  if (!isSameOrigin(request)) return { response: jsonError("Permintaan lintas situs ditolak.", 403) };
  try {
    const user = await getSessionUser(request);
    if (!user) return { response: jsonError("Silakan masuk kembali.", 401) };
    return { user };
  } catch (error) {
    console.error("Gagal memeriksa sesi pengguna.", error);
    return { response: jsonError("Layanan autentikasi sedang tidak tersedia.", 503) };
  }
}

export async function requireRole(request, roles) {
  const result = await requireUser(request);
  if (result.response) return result;
  if (!roles.includes(result.user.role)) {
    return { response: jsonError("Anda tidak memiliki akses untuk tindakan ini.", 403) };
  }
  return result;
}

export function secureTokenEquals(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}
