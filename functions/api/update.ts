
interface Env {
  KV_STORE: any;
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  
  // --- AUTHENTICATION ---
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  
  // Verify Access Token existence in KV
  // Since we use KV TTL, if the key exists, it is valid.
  const sessionValid = await env.KV_STORE.get(`access:${token}`);
  
  if (!sessionValid) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
  }
  // ----------------------

  try {
    const body: any = await request.json();
    const { type, data } = body;

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
