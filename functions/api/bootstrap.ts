
interface Env {
  KV_STORE: any;
}

const safeParse = (str: string | null) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

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
    categories: safeParse(categories),
    background: background || null, // background is just a string in KV, no parse needed unless legacy
    prefs: safeParse(prefs),
    // Don't send the actual code, just a boolean if it's the default or custom
    isDefaultCode: !authCode
  };

  return new Response(JSON.stringify(responseData), {
    headers: { "Content-Type": "application/json" }
  });
}
