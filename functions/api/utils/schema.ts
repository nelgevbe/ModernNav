export type D1 = D1Database;

export const CURRENT_SCHEMA_VERSION = 2;

let schemaReady = false;

export async function ensureSchema(db: D1): Promise<void> {
  if (schemaReady) return;
  await db.exec("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)");
  await db.exec(
    "CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, title TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))"
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS subcategories (id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE, title TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))"
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, subcategory_id TEXT NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL, description TEXT, icon TEXT, position INTEGER NOT NULL DEFAULT 0, visit_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))"
  );
  await db.exec("CREATE INDEX IF NOT EXISTS idx_sub_cat ON subcategories(category_id, position)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_link_sub ON links(subcategory_id, position)");
  await db.exec(
    "CREATE TABLE IF NOT EXISTS rate_limits (identifier TEXT NOT NULL, scope TEXT NOT NULL, window_end INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (identifier, scope))"
  );
  await db.exec("CREATE INDEX IF NOT EXISTS idx_rl_window ON rate_limits(window_end)");
  schemaReady = true;
}

export function _resetSchemaCacheForTests(): void {
  schemaReady = false;
}

export async function getSchemaVersion(db: D1): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM config WHERE key = 'schema_version'")
    .first<{ value: string }>();
  return row?.value ? parseInt(row.value, 10) || 1 : 1;
}
