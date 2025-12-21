interface Env {
  DB: D1Database;
}

const ACCESS_TTL = 30 * 60 * 1000; // 30分钟
const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000; // 7天

// --- 加密助手 ---
async function sign(data: string, secret: string): Promise<string> {
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

async function verify(token: string, secret: string): Promise<boolean> {
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

async function generateToken(
  type: "access" | "refresh",
  secret: string
): Promise<string> {
  const payload = btoa(
    JSON.stringify({
      exp: Date.now() + (type === "access" ? ACCESS_TTL : REFRESH_TTL),
      type,
    })
  );
  return `${payload}.${await sign(payload, secret)}`;
}

// --- Cookie 助手 ---
const respondWithCookie = (body: any, token: string, clear = false) => {
  const cookie = `refresh_token=${
    clear ? "" : token
  }; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${
    clear ? 0 : REFRESH_TTL / 1000
  }`;
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
};

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  const body = (await request.json()) as any;
  const { action, code, currentCode, newCode } = body;

  const codeRow = await env.DB.prepare(
    "SELECT value FROM config WHERE key = 'auth_code'"
  ).first<{ value: string }>();
  const storedCode = codeRow?.value || "admin";

  // 1. 登录
  if (action === "login") {
    if (code !== storedCode)
      return new Response(JSON.stringify({ error: "密码错误" }), {
        status: 401,
      });
    return respondWithCookie(
      { success: true, accessToken: await generateToken("access", storedCode) },
      await generateToken("refresh", storedCode)
    );
  }

  // 2. 刷新 Token
  if (action === "refresh") {
    const rfToken = request.headers
      .get("Cookie")
      ?.match(/refresh_token=([^;]+)/)?.[1];
    if (!rfToken || !(await verify(rfToken, storedCode)))
      return respondWithCookie({ error: "会话过期" }, "", true);
    return respondWithCookie(
      { success: true, accessToken: await generateToken("access", storedCode) },
      await generateToken("refresh", storedCode)
    );
  }

  // 3. 修改密码
  if (action === "update") {
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (
      !token ||
      !(await verify(token, storedCode)) ||
      currentCode !== storedCode
    ) {
      return new Response(JSON.stringify({ error: "鉴权失败" }), {
        status: 403,
      });
    }
    await env.DB.prepare(
      "INSERT INTO config (key, value) VALUES ('auth_code', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
      .bind(newCode)
      .run();
    return new Response(JSON.stringify({ success: true }));
  }

  return new Response(JSON.stringify({ success: true })); // Logout 等其他操作
};
