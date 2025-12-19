
interface Env {
  KV_STORE: any;
}

// Configuration
const ACCESS_TTL = 15 * 60; // 15 minutes
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

// Helper: Generate Secure Random Token
const generateToken = () => {
  return crypto.randomUUID();
};

// Helper: Parse Cookies
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

// Helper: Response with Cookie
const respondWithCookie = (body: any, refreshToken: string, clear = false) => {
  const maxAge = clear ? 0 : REFRESH_TTL;
  const cookieValue = clear ? '' : refreshToken;
  
  // Construct Set-Cookie header manually
  // HttpOnly: Not accessible via JS
  // Secure: HTTPS only
  // SameSite=Strict: CSRF protection
  // Path: Limit scope
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
  
  // Handle Refresh Action (Action might be implied by lack of body for refresh, but we keep the pattern)
  // We read body safely
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine for some actions if we rely on cookies
  }

  const { action, code, currentCode, newCode } = body;
  const storedCode = await env.KV_STORE.get("auth_code") || "admin";

  // --- 1. LOGIN ---
  if (action === 'login') {
    if (code !== storedCode) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    const accessToken = generateToken();
    const refreshToken = generateToken();

    // Store Access Token (Short lived)
    await env.KV_STORE.put(`access:${accessToken}`, "1", { expirationTtl: ACCESS_TTL });
    
    // Store Refresh Token (Long lived) - Support Rotation
    await env.KV_STORE.put(`refresh:${refreshToken}`, "1", { expirationTtl: REFRESH_TTL });

    return respondWithCookie({ success: true, accessToken }, refreshToken);
  }

  // --- 2. REFRESH (Token Rotation) ---
  if (action === 'refresh') {
    const refreshToken = getCookie(request, 'refresh_token');
    
    if (!refreshToken) {
      return new Response(JSON.stringify({ error: "No refresh token" }), { status: 401 });
    }

    // Verify Refresh Token in KV
    const isValid = await env.KV_STORE.get(`refresh:${refreshToken}`);
    
    // Security: Delete the used refresh token immediately (Rotation)
    await env.KV_STORE.delete(`refresh:${refreshToken}`);

    if (!isValid) {
      // Possible reuse attack or expired
      return respondWithCookie({ error: "Invalid refresh token" }, "", true); // Clear cookie
    }

    // Issue New Pair
    const newAccessToken = generateToken();
    const newRefreshToken = generateToken();

    await env.KV_STORE.put(`access:${newAccessToken}`, "1", { expirationTtl: ACCESS_TTL });
    await env.KV_STORE.put(`refresh:${newRefreshToken}`, "1", { expirationTtl: REFRESH_TTL });

    return respondWithCookie({ success: true, accessToken: newAccessToken }, newRefreshToken);
  }

  // --- 3. LOGOUT ---
  if (action === 'logout') {
    const refreshToken = getCookie(request, 'refresh_token');
    if (refreshToken) {
      await env.KV_STORE.delete(`refresh:${refreshToken}`);
    }
    return respondWithCookie({ success: true }, "", true);
  }

  // --- 4. UPDATE PASSWORD ---
  if (action === 'update') {
    // Authorization Check: Bearer Access Token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    
    // Validate Access Token via KV
    const isValidSession = await env.KV_STORE.get(`access:${token}`);
    if (!isValidSession) {
       return new Response(JSON.stringify({ error: "Token expired" }), { status: 401 });
    }

    // Verify current code logic
    if (currentCode !== storedCode) {
       return new Response(JSON.stringify({ error: "Current code incorrect" }), { status: 403 });
    }

    if (!newCode || newCode.length < 4) {
      return new Response(JSON.stringify({ error: "Invalid new code" }), { status: 400 });
    }

    // Update Code
    await env.KV_STORE.put("auth_code", newCode);
    
    // Optional: Revoke all sessions? For now, we keep them alive until they expire or logout.
    
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
};
