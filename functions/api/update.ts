interface Env {
  DB?: D1Database;
}

import { verify, getClientIP, RateLimiter, ERROR_MESSAGES } from "./utils/authHelpers";
import { ensureSchema } from "./utils/schema";
import { readAllCategories } from "./utils/reads";
import { diffCategories, applyCategoryDiff } from "./utils/diff";
import { UpdatePayload, Category } from "../../src/types";
import { validateFullCategory, validatePreferences, validateBackground } from "./utils/validation";

const updateRateLimiter = new RateLimiter("data_update", 20, 60 * 1000);

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const clientIP = getClientIP(request);

    if (env.DB) await ensureSchema(env.DB);

    if (!(await updateRateLimiter.isAllowed(env.DB, clientIP))) {
      return jsonError(ERROR_MESSAGES.RATE_LIMITED, 429);
    }

    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) return jsonError(ERROR_MESSAGES.UNAUTHORIZED, 401);
    if (!env.DB) return jsonError("Database not available", 503);

    const codeRow = await env.DB.prepare("SELECT value FROM config WHERE key = 'auth_code'").first<{
      value: string;
    }>();
    const storedCode = codeRow?.value || "admin";

    if (!(await verify(token, storedCode))) {
      return jsonError(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const body = (await request.json()) as UpdatePayload;
    if (!body || typeof body !== "object" || !body.type) {
      return jsonError(ERROR_MESSAGES.INVALID_DATA, 400);
    }

    const { type, data } = body;
    if (data === undefined || data === null) {
      return jsonError(ERROR_MESSAGES.INVALID_DATA, 400);
    }

    const allowedTypes = ["categories", "background", "prefs", "auth_code"];
    if (!allowedTypes.includes(type)) {
      return jsonError(ERROR_MESSAGES.INVALID_DATA, 400);
    }

    // --- Categories: diff-based write ---
    // Read current state, compute a minimal diff, and apply only the changed
    // rows in one D1 batch. A single rename used to wipe + rewrite the whole
    // tree (hundreds of rows); now it emits one UPDATE.
    if (type === "categories") {
      if (!Array.isArray(data)) return jsonError("Categories must be an array", 400);
      if (data.length > 50) return jsonError("Too many categories (max 50)", 400);

      for (const cat of data) {
        const v = validateFullCategory(cat);
        if (!v.valid) return jsonError(v.message || ERROR_MESSAGES.INVALID_DATA, 400);
      }

      const current = await readAllCategories(env.DB);
      const diff = diffCategories(current, data as Category[]);
      await applyCategoryDiff(env.DB, diff);
      return jsonOk();
    }

    // --- Background: KV ---
    if (type === "background") {
      const v = validateBackground(data);
      if (!v.valid) return jsonError(v.message || ERROR_MESSAGES.INVALID_DATA, 400);
      const value = typeof data === "string" ? data : JSON.stringify(data);
      await upsertConfig(env.DB, "background", value);
      return jsonOk();
    }

    // --- Prefs: KV (JSON) ---
    if (type === "prefs") {
      const v = validatePreferences(data);
      if (!v.valid) return jsonError(v.message || ERROR_MESSAGES.INVALID_DATA, 400);
      const value = typeof data === "string" ? data : JSON.stringify(data);
      if (value.length > 10_000) return jsonError("Preferences too large (max 10KB)", 400);
      await upsertConfig(env.DB, "prefs", value);
      return jsonOk();
    }

    // --- auth_code: KV ---
    if (type === "auth_code") {
      const value = typeof data === "string" ? data : JSON.stringify(data);
      await upsertConfig(env.DB, "auth_code", value);
      return jsonOk();
    }

    return jsonError(ERROR_MESSAGES.INVALID_DATA, 400);
  } catch (error) {
    console.error("Update API Error:", error);
    return jsonError(ERROR_MESSAGES.SERVER_ERROR, 500);
  }
};

async function upsertConfig(db: D1Database, key: string, value: string) {
  await db
    .prepare(
      "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(key, value)
    .run();
}

function jsonOk() {
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
