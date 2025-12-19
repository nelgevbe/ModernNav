
interface Env {
  KV_STORE: any;
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
  const { request, env } = context;
  
  // --- AUTHENTICATION ---
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  
  // Get the Secret (Admin Code)
  const storedCode = await env.KV_STORE.get("auth_code") || "admin";

  // Verify Statelessly
  const sessionValid = await verify(token, storedCode);
  
  if (!sessionValid) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
  }
  // ----------------------

  try {
    const body: any = await request.json();
    const { type, data } = body;

    // These writes are the only KV writes that will happen now
    if (type === 'categories') {
      await env.KV_STORE.put("categories", JSON.stringify(data));
    } else if (type === 'background') {
      await env.KV_STORE.put("background", data);
    } else if (type === 'prefs') {
      await env.KV_STORE.put("prefs", JSON.stringify(data));
    } else {
      return new Response("Invalid type", { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response("Error processing request", { status: 500 });
  }
}
