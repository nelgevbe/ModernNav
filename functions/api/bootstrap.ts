
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
  const { env } = context as { env: Env };
  
  try {
    // Fetch all config in one query
    const { results } = await env.DB.prepare("SELECT key, value FROM config").all();
    
    // Map array of rows to an object map
    const configMap = new Map();
    if (results) {
      results.forEach((row: any) => {
        configMap.set(row.key, row.value);
      });
    }

    const categories = configMap.get("categories");
    const background = configMap.get("background");
    const prefs = configMap.get("prefs");
    const authCode = configMap.get("auth_code");

    const responseData = {
      categories: safeParse(categories),
      background: background || null, 
      prefs: safeParse(prefs),
      // Don't send the actual code, just a boolean if it's the default or custom
      isDefaultCode: !authCode
    };

    return new Response(JSON.stringify(responseData), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("D1 Error:", e);
    // Fallback empty response or error
    return new Response(JSON.stringify({ 
      categories: [], 
      background: null, 
      prefs: null, 
      isDefaultCode: true 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}