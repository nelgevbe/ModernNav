import { BootstrapResponse } from "../../src/types";
import { getJwtSecret, verify } from "./utils/authHelpers";
import { migrateIfNeeded } from "./utils/migration";
import {
  readAllCategories,
  getBootstrapConfig,
  getDefaultCategories,
  getDefaultBackground,
  getDefaultPrefs,
} from "./utils/reads";

interface Env {
  DB?: D1Database;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    if (!env.DB) {
      const fallback: BootstrapResponse = {
        categories: getDefaultCategories(),
        background: getDefaultBackground(),
        prefs: getDefaultPrefs(),
        isDefaultCode: true,
        dataVersion: 0,
      };
      return jsonResponse(fallback, 200);
    }

    await migrateIfNeeded(env.DB);

    // Private categories are visible only to authenticated sessions; an
    // invalid or missing token silently degrades to the visitor view.
    let authenticated = false;
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (token) {
      try {
        authenticated = await verify(token, await getJwtSecret(env.DB), "access");
      } catch {
        authenticated = false;
      }
    }

    const [categories, cfg] = await Promise.all([
      readAllCategories(env.DB),
      getBootstrapConfig(env.DB),
    ]);

    const allCategories = categories.length > 0 ? categories : getDefaultCategories();
    const visibleCategories = authenticated
      ? allCategories
      : allCategories.filter((c) => !c.isPrivate);

    const response: BootstrapResponse = {
      categories: visibleCategories,
      background: cfg.background,
      prefs: cfg.prefs,
      isDefaultCode: cfg.isDefaultCode,
      dataVersion: cfg.dataVersion,
    };
    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Bootstrap API Error:", error);
    return jsonResponse(
      {
        categories: getDefaultCategories(),
        background: getDefaultBackground(),
        prefs: getDefaultPrefs(),
        isDefaultCode: true,
        dataVersion: 0,
        error: "Failed to load configuration, using defaults",
      } as BootstrapResponse,
      500
    );
  }
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
