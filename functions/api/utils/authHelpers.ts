// 认证相关的工具函数

const ACCESS_TTL = 60 * 60 * 1000; // 60分钟
const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000; // 7天

// 错误消息
const ERROR_MESSAGES = {
  INVALID_TOKEN: "Invalid or expired token",
  UNAUTHORIZED: "Unauthorized access",
  RATE_LIMITED: "Too many requests, please try again later",
  INVALID_CREDENTIALS: "Invalid credentials",
  SERVER_ERROR: "Server error, please try again later",
  INVALID_DATA: "Invalid data format",
  DATA_NOT_FOUND: "Requested data not found",
};

// 加密助手
export async function sign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verify(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, signatureB64] = token.split(".");
    const expectedSignature = await sign(payloadB64, secret);
    if (signatureB64 !== expectedSignature) return false;
    const payload = JSON.parse(atob(payloadB64));
    return Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export async function generateToken(type: "access" | "refresh", secret: string): Promise<string> {
  const payload = btoa(
    JSON.stringify({
      exp: Date.now() + (type === "access" ? ACCESS_TTL : REFRESH_TTL),
      type,
    })
  );
  return payload + "." + (await sign(payload, secret));
}

// Cookie 助手
export function respondWithCookie(body: unknown, token: string, clear = false, status = 200) {
  const cookie =
    "refresh_token=" +
    (clear ? "" : token) +
    "; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=" +
    (clear ? 0 : REFRESH_TTL / 1000);

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
      // 增加安全头
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

// D1-backed per-IP rate limiter. The previous in-process Map was reset on every
// cold start and not shared between isolates, so an attacker hitting different
// POPs effectively had no limit. The UPSERT + RETURNING runs in a single round
// trip and resets the window in-place when it has expired.
//
// Fail-open behavior on missing env.DB matches the pre-D1 effective state
// (in-process Map was already useless across isolates); a one-time console
// warning surfaces the misconfiguration without spamming logs.
export class RateLimiter {
  private static warned = false;

  constructor(
    private scope: string,
    private maxRequests: number,
    private windowMs: number
  ) {}

  async isAllowed(db: D1Database | undefined, identifier: string): Promise<boolean> {
    if (!db) {
      this.warnOnce();
      return true;
    }
    const now = Date.now();
    const newEnd = now + this.windowMs;
    const row = await db
      .prepare(
        `INSERT INTO rate_limits (identifier, scope, window_end, count)
         VALUES (?1, ?2, ?3, 1)
         ON CONFLICT(identifier, scope) DO UPDATE SET
           count = CASE WHEN window_end < ?4 THEN 1 ELSE count + 1 END,
           window_end = CASE WHEN window_end < ?4 THEN ?3 ELSE window_end END
         RETURNING count, window_end`
      )
      .bind(identifier, this.scope, newEnd, now)
      .first<{ count: number; window_end: number }>();
    return (row?.count ?? 0) <= this.maxRequests;
  }

  async getResetTime(db: D1Database | undefined, identifier: string): Promise<number> {
    if (!db) return Date.now() + this.windowMs;
    const row = await db
      .prepare("SELECT window_end FROM rate_limits WHERE identifier = ?1 AND scope = ?2")
      .bind(identifier, this.scope)
      .first<{ window_end: number }>();
    return row?.window_end ?? Date.now() + this.windowMs;
  }

  private warnOnce() {
    if (RateLimiter.warned) return;
    RateLimiter.warned = true;
    console.warn("[RateLimiter] env.DB unavailable — failing open. Rate limiting disabled.");
  }
}

// 获取客户端IP助手
export function getClientIP(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown"
  );
}

export { ACCESS_TTL, REFRESH_TTL, ERROR_MESSAGES };
