
interface Env {
  KV_STORE: any;
}

// Configuration
const ACCESS_TTL = 30 * 60 * 1000; // 30 minutes (in ms)
const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (in ms)

// --- CRYPTO HELPERS (Stateless Logic) ---

async function sign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  // Convert ArrayBuffer to Base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verify(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, signatureB64] = token.split('.');
    if (!payloadB64 || !signatureB64) return false;

    // 1. Re-calculate signature
    const expectedSignature = await sign(payloadB64, secret);
    
    // 2. Check Signature (Constant time comparison not strictly needed for this scope, but good practice)
    if (signatureB64 !== expectedSignature) return false;

    // 3. Check Expiry
    const payload = JSON.parse(atob(payloadB64));
    if (Date.now() > payload.exp) return false;

    return true;
  } catch (e) {
    return false;
  }
}

async function generateToken(type: 'access' | 'refresh', secret: string): Promise<string> {
  const ttl = type === 'access' ? ACCESS_TTL : REFRESH_TTL;
  const payload = {
    exp: Date.now() + ttl,
    type
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const signature = await sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

// --- HELPER: COOKIES ---
const getCookie = (request: Request, name: string) => {
  const cookieString = request.headers.get('Cookie');
  if (!cookieString) return null;
  const cookies = cookieString.split(';');
  for (const cookie of cookies) {
    const [k, v] = cookie.split('=').map(c => c.trim());
    if (k === name) return v;
  }
  return null;
};

const respondWithCookie = (body: any, refreshToken: string, clear = false) => {
  const maxAge = clear ? 0 : (REFRESH_TTL / 1000); // Max-Age is in seconds
  const cookieValue = clear ? '' : refreshToken;
  
  const cookieHeader = `refresh_token=${cookieValue}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${maxAge}`;

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader
    }
  });
};

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  
  let body: any = {};
  try { body = await request.json(); } catch {}

  const { action, code, currentCode, newCode } = body;
  // Get the Fixed Secret (The Admin Code)
  const storedCode = await env.KV_STORE.get("auth_code") || "admin";

  // --- 1. LOGIN ---
  if (action === 'login') {
    if (code !== storedCode) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    // Generate Stateless Tokens signed with the password
    const accessToken = await generateToken('access', storedCode);
    const refreshToken = await generateToken('refresh', storedCode);

    // NO KV WRITES HERE!
    return respondWithCookie({ success: true, accessToken }, refreshToken);
  }

  // --- 2. REFRESH ---
  if (action === 'refresh') {
    const refreshToken = getCookie(request, 'refresh_token');
    
    if (!refreshToken) {
      return new Response(JSON.stringify({ error: "No refresh token" }), { status: 401 });
    }

    // Verify the token statelessly
    const isValid = await verify(refreshToken, storedCode);
    
    if (!isValid) {
      return respondWithCookie({ error: "Invalid or expired session" }, "", true);
    }

    // Issue New Pair
    const newAccessToken = await generateToken('access', storedCode);
    const newRefreshToken = await generateToken('refresh', storedCode);

    return respondWithCookie({ success: true, accessToken: newAccessToken }, newRefreshToken);
  }

  // --- 3. LOGOUT ---
  if (action === 'logout') {
    // Just clear the cookie on client
    return respondWithCookie({ success: true }, "", true);
  }

  // --- 4. UPDATE PASSWORD ---
  if (action === 'update') {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    
    // Verify Access Token Statelessly
    const isValidSession = await verify(token, storedCode);
    if (!isValidSession) {
       return new Response(JSON.stringify({ error: "Token expired" }), { status: 401 });
    }

    if (currentCode !== storedCode) {
       return new Response(JSON.stringify({ error: "Current code incorrect" }), { status: 403 });
    }

    if (!newCode || newCode.length < 4) {
      return new Response(JSON.stringify({ error: "Invalid new code" }), { status: 400 });
    }

    await env.KV_STORE.put("auth_code", newCode);
    
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
};
