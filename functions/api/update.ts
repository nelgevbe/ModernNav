
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: any;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}

interface Env {
  DB: D1Database;
  // KV_STORE binding is removed
}

// --- CRYPTO HELPERS (Duplicated to avoid build complexity in simple Pages Functions) ---
async function sign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verify(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, signatureB64] = token.split('.');
    if (!payloadB64 || !signatureB64) return false;
    
    const expectedSignature = await sign(payloadB64, secret);
    if (signatureB64 !== expectedSignature) return false;

    const payload = JSON.parse(atob(payloadB64));
    if (Date.now() > payload.exp) return false;

    return true;
  } catch (e) {
    return false;
  }
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context as { request: Request, env: Env };
  
  // --- AUTHENTICATION ---
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  
  // Get the Secret (Admin Code) from D1
  const codeResult = await env.DB.prepare("SELECT value FROM config WHERE key = 'auth_code'").first();
  const storedCode = (codeResult?.value as string) || "admin";

  // Verify Statelessly
  const sessionValid = await verify(token, storedCode);
  
  if (!sessionValid) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
  }
  // ----------------------

  try {
    const body: any = await request.json();
    const { type, data } = body;

    let valueToStore: string;

    // Normalize data to string
    if (type === 'categories' || type === 'prefs') {
      valueToStore = JSON.stringify(data);
    } else if (type === 'background') {
      valueToStore = typeof data === 'string' ? data : JSON.stringify(data);
    } else {
      return new Response("Invalid type", { status: 400 });
    }

    // D1 Upsert (Insert or Replace)
    await env.DB.prepare(
      "INSERT INTO config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2"
    ).bind(type, valueToStore).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Update Error:", e);
    return new Response("Error processing request", { status: 500 });
  }
}