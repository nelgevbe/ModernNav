
interface Env {
  KV_STORE: any;
}

export const onRequestGet = async (context: any) => {
  const { env } = context;
  
  // Fetch all data in parallel
  const [categories, background, prefs, authCode] = await Promise.all([
    env.KV_STORE.get("categories"),
    env.KV_STORE.get("background"),
    env.KV_STORE.get("prefs"),
    env.KV_STORE.get("auth_code")
  ]);

  const responseData = {
    categories: categories ? JSON.parse(categories) : null, // Null will trigger default on frontend
    background: background || null,
    prefs: prefs ? JSON.parse(prefs) : null,
    // Don't send the actual code, just a boolean if it's the default or custom
    isDefaultCode: !authCode
  };

  return new Response(JSON.stringify(responseData), {
    headers: { "Content-Type": "application/json" }
  });
}