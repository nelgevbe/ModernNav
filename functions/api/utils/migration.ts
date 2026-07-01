import type { Category } from "../../../src/types";
import type { D1 } from "./schema";
import { ensureSchema, getSchemaVersion, CURRENT_SCHEMA_VERSION } from "./schema";
import { writeAllCategories } from "./writes";

export async function migrateIfNeeded(db: D1): Promise<void> {
  await ensureSchema(db);
  const version = await getSchemaVersion(db);
  if (version >= CURRENT_SCHEMA_VERSION) return;

  const legacy = await db
    .prepare("SELECT value FROM config WHERE key = 'categories'")
    .first<{ value: string }>();

  if (legacy?.value) {
    try {
      const parsed = JSON.parse(legacy.value) as Category[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        await writeAllCategories(db, parsed);
      }
    } catch (e) {
      console.error("v1->v2 migration: invalid legacy categories JSON, skipping", e);
    }
  }

  await db
    .prepare(
      "INSERT INTO config (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(String(CURRENT_SCHEMA_VERSION))
    .run();
}
