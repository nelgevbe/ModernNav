interface Env {
  DB: D1Database;
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM config"
    ).all<{ key: string; value: string }>();

    const configMap = new Map();
    results?.forEach((row) => configMap.set(row.key, row.value));

    const authCode = configMap.get("auth_code");

    return new Response(
      JSON.stringify({
        categories: JSON.parse(configMap.get("categories") || "[]"),
        background: configMap.get("background") || null,
        prefs: JSON.parse(configMap.get("prefs") || "null"),
        isDefaultCode: !authCode || authCode === "admin",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ categories: [], isDefaultCode: true }),
      { status: 500 }
    );
  }
};
