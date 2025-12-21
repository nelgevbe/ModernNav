interface Env {
  DB: D1Database;
}

// 复用 Auth 里的 verify 函数逻辑 (实际开发建议抽离为公共函数)
async function verify(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, signatureB64] = token.split(".");
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(payloadB64)
    );
    const expectedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signature))
    );
    return (
      signatureB64 === expectedSignature &&
      JSON.parse(atob(payloadB64)).exp > Date.now()
    );
  } catch {
    return false;
  }
}

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  // 1. 鉴权
  const token = request.headers.get("Authorization")?.split(" ")[1];
  const codeRow = await env.DB.prepare(
    "SELECT value FROM config WHERE key = 'auth_code'"
  ).first<{ value: string }>();
  const storedCode = codeRow?.value || "admin";

  if (!token || !(await verify(token, storedCode))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  // 2. 写入数据 (利用 UPSERT)
  try {
    const { type, data } = (await request.json()) as any;
    const value = typeof data === "string" ? data : JSON.stringify(data);

    await env.DB.prepare(
      "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
      .bind(type, value)
      .run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response("Update Failed", { status: 500 });
  }
};
