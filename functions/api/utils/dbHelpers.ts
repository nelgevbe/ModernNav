// Shared D1 helpers: schema bootstrap, lazy migration v1 -> v2, relational reads/writes.
// The legacy schema stored everything as JSON in config(key,value). v2 splits
// categories/subcategories/links into rows so updates are diff-based instead of
// overwriting 100KB blobs.

import type { Category, SubCategory, LinkItem, UserPreferences } from "../../../src/types";

// @ts-expect-error - D1Database is provided by Cloudflare environment
export type D1 = D1Database;

export const CURRENT_SCHEMA_VERSION = 2;

const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "home",
    title: "Home",
    subCategories: [
      {
        id: "default",
        title: "Default",
        items: [
          { id: "1", title: "Google", url: "https://google.com", icon: "Search" },
          { id: "2", title: "GitHub", url: "https://github.com", icon: "Github" },
        ],
      },
    ],
  },
];

const DEFAULT_BACKGROUND = "radial-gradient(circle at 50% -20%, #334155, #0f172a, #020617)";

const DEFAULT_PREFS: UserPreferences = {
  cardOpacity: 0.1,
  themeColor: "#6280a3",
  // @ts-expect-error - ThemeMode enum value string
  themeMode: "dark",
};

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

// CREATE ... IF NOT EXISTS is idempotent and has no side effects once the
// tables exist. We gate it behind a module-level flag so repeat requests
// within the same isolate skip the 6 exec calls entirely. (A fresh isolate
// will re-run once — that's fine and unavoidable.)
let schemaReady = false;

export async function ensureSchema(db: D1): Promise<void> {
  if (schemaReady) return;
  // Create relational tables if missing (idempotent).
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
  schemaReady = true;
}

// Exposed for tests so they can reset the module flag between cases.
export function _resetSchemaCacheForTests(): void {
  schemaReady = false;
}

export async function getSchemaVersion(db: D1): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM config WHERE key = 'schema_version'")
    .first<{ value: string }>();
  return row?.value ? parseInt(row.value, 10) || 1 : 1;
}

export async function migrateIfNeeded(db: D1): Promise<void> {
  await ensureSchema(db);
  const version = await getSchemaVersion(db);
  if (version >= CURRENT_SCHEMA_VERSION) return;

  // v1 -> v2: read legacy categories JSON, fan out into relational rows.
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

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  title: string;
  position: number;
}
interface SubRow {
  id: string;
  category_id: string;
  title: string;
  position: number;
}
interface LinkRow {
  id: string;
  subcategory_id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  position: number;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function readAllCategories(db: D1): Promise<Category[]> {
  const [{ results: cats }, { results: subs }, { results: links }] = await Promise.all([
    db
      .prepare("SELECT id, title, position FROM categories ORDER BY position ASC, id ASC")
      .all<CategoryRow>(),
    db
      .prepare(
        "SELECT id, category_id, title, position FROM subcategories ORDER BY position ASC, id ASC"
      )
      .all<SubRow>(),
    db
      .prepare(
        "SELECT id, subcategory_id, title, url, description, icon, position FROM links ORDER BY position ASC, id ASC"
      )
      .all<LinkRow>(),
  ]);

  return rebuildCategories(cats ?? [], subs ?? [], links ?? []);
}

// Pure projection from row sets to the nested Category[] shape. Extracted so
// tests can drive it without a D1 binding.
export function rebuildCategories(
  cats: CategoryRow[],
  subs: SubRow[],
  links: LinkRow[]
): Category[] {
  if (!cats || cats.length === 0) return [];

  const linksBySub = new Map<string, LinkItem[]>();
  for (const l of links ?? []) {
    const item: LinkItem = {
      id: l.id,
      title: l.title,
      url: l.url,
      ...(l.description ? { description: l.description } : {}),
      ...(l.icon ? { icon: l.icon } : {}),
    };
    const arr = linksBySub.get(l.subcategory_id);
    if (arr) arr.push(item);
    else linksBySub.set(l.subcategory_id, [item]);
  }

  const subsByCat = new Map<string, SubCategory[]>();
  for (const s of subs ?? []) {
    const sub: SubCategory = {
      id: s.id,
      title: s.title,
      items: linksBySub.get(s.id) ?? [],
    };
    const arr = subsByCat.get(s.category_id);
    if (arr) arr.push(sub);
    else subsByCat.set(s.category_id, [sub]);
  }

  return cats.map((c) => ({
    id: c.id,
    title: c.title,
    subCategories: subsByCat.get(c.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

export interface CategoryDiff {
  categories: { inserts: CatRowInput[]; updates: CatUpdate[]; deletes: string[] };
  subcategories: { inserts: SubRowInput[]; updates: SubUpdate[]; deletes: string[] };
  links: { inserts: LinkRowInput[]; updates: LinkUpdate[]; deletes: string[] };
  isEmpty: boolean;
}

interface CatRowInput {
  id: string;
  title: string;
  position: number;
}
interface CatUpdate {
  id: string;
  title?: string;
  position?: number;
}
interface SubRowInput {
  id: string;
  categoryId: string;
  title: string;
  position: number;
}
interface SubUpdate {
  id: string;
  categoryId?: string;
  title?: string;
  position?: number;
}
interface LinkRowInput {
  id: string;
  subcategoryId: string;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  position: number;
}
interface LinkUpdate {
  id: string;
  subcategoryId?: string;
  title?: string;
  url?: string;
  description?: string | null;
  icon?: string | null;
  position?: number;
}

// Flatten the nested Category[] into id-indexed row maps so diffing is O(n).
interface FlatState {
  cats: Map<string, { title: string; position: number }>;
  subs: Map<string, { categoryId: string; title: string; position: number }>;
  links: Map<
    string,
    {
      subcategoryId: string;
      title: string;
      url: string;
      description: string | null;
      icon: string | null;
      position: number;
    }
  >;
}

function flattenCategories(categories: Category[]): FlatState {
  const cats = new Map<string, { title: string; position: number }>();
  const subs = new Map<string, { categoryId: string; title: string; position: number }>();
  const links = new Map<
    string,
    {
      subcategoryId: string;
      title: string;
      url: string;
      description: string | null;
      icon: string | null;
      position: number;
    }
  >();

  categories.forEach((cat, ci) => {
    cats.set(cat.id, { title: cat.title, position: ci });
    cat.subCategories?.forEach((sub, si) => {
      subs.set(sub.id, { categoryId: cat.id, title: sub.title, position: si });
      sub.items?.forEach((link, li) => {
        links.set(link.id, {
          subcategoryId: sub.id,
          title: link.title,
          url: link.url,
          description: link.description ?? null,
          icon: link.icon ?? null,
          position: li,
        });
      });
    });
  });

  return { cats, subs, links };
}

// Compute a minimal diff between current and next states. Pure function.
// Drops on parent entities imply their children are gone too — when a
// category is deleted we do NOT also emit per-child deletes (the ON DELETE
// CASCADE on subcategories/links handles cleanup). Same for subcategory drops.
export function diffCategories(current: Category[], next: Category[]): CategoryDiff {
  const cur = flattenCategories(current);
  const nxt = flattenCategories(next);

  const catInserts: CatRowInput[] = [];
  const catUpdates: CatUpdate[] = [];
  const catDeletes: string[] = [];
  const subInserts: SubRowInput[] = [];
  const subUpdates: SubUpdate[] = [];
  const subDeletes: string[] = [];
  const linkInserts: LinkRowInput[] = [];
  const linkUpdates: LinkUpdate[] = [];
  const linkDeletes: string[] = [];

  // --- categories ---
  for (const [id, nextRow] of nxt.cats) {
    const curRow = cur.cats.get(id);
    if (!curRow) {
      catInserts.push({ id, title: nextRow.title, position: nextRow.position });
    } else {
      const update: CatUpdate = { id };
      if (curRow.title !== nextRow.title) update.title = nextRow.title;
      if (curRow.position !== nextRow.position) update.position = nextRow.position;
      if (Object.keys(update).length > 1) catUpdates.push(update);
    }
  }
  for (const id of cur.cats.keys()) {
    if (!nxt.cats.has(id)) catDeletes.push(id);
  }

  // --- subcategories ---
  for (const [id, nextRow] of nxt.subs) {
    const curRow = cur.subs.get(id);
    if (!curRow) {
      subInserts.push({
        id,
        categoryId: nextRow.categoryId,
        title: nextRow.title,
        position: nextRow.position,
      });
    } else {
      const update: SubUpdate = { id };
      if (curRow.categoryId !== nextRow.categoryId) update.categoryId = nextRow.categoryId;
      if (curRow.title !== nextRow.title) update.title = nextRow.title;
      if (curRow.position !== nextRow.position) update.position = nextRow.position;
      if (Object.keys(update).length > 1) subUpdates.push(update);
    }
  }
  // Only emit explicit sub deletes for subs whose parent still exists —
  // subs under a deleted category are removed by cascade.
  for (const id of cur.subs.keys()) {
    if (nxt.subs.has(id)) continue;
    const curRow = cur.subs.get(id)!;
    // Parent category also deleted -> cascade will handle it.
    if (!nxt.cats.has(curRow.categoryId)) continue;
    subDeletes.push(id);
  }

  // --- links ---
  for (const [id, nextRow] of nxt.links) {
    const curRow = cur.links.get(id);
    if (!curRow) {
      linkInserts.push({
        id,
        subcategoryId: nextRow.subcategoryId,
        title: nextRow.title,
        url: nextRow.url,
        description: nextRow.description,
        icon: nextRow.icon,
        position: nextRow.position,
      });
    } else {
      const update: LinkUpdate = { id };
      if (curRow.subcategoryId !== nextRow.subcategoryId)
        update.subcategoryId = nextRow.subcategoryId;
      if (curRow.title !== nextRow.title) update.title = nextRow.title;
      if (curRow.url !== nextRow.url) update.url = nextRow.url;
      if (curRow.description !== nextRow.description) update.description = nextRow.description;
      if (curRow.icon !== nextRow.icon) update.icon = nextRow.icon;
      if (curRow.position !== nextRow.position) update.position = nextRow.position;
      if (Object.keys(update).length > 1) linkUpdates.push(update);
    }
  }
  // Only emit explicit link deletes for links whose parent sub still exists.
  for (const id of cur.links.keys()) {
    if (nxt.links.has(id)) continue;
    const curRow = cur.links.get(id)!;
    if (!nxt.subs.has(curRow.subcategoryId)) continue;
    linkDeletes.push(id);
  }

  const isEmpty =
    catInserts.length === 0 &&
    catUpdates.length === 0 &&
    catDeletes.length === 0 &&
    subInserts.length === 0 &&
    subUpdates.length === 0 &&
    subDeletes.length === 0 &&
    linkInserts.length === 0 &&
    linkUpdates.length === 0 &&
    linkDeletes.length === 0;

  return {
    categories: { inserts: catInserts, updates: catUpdates, deletes: catDeletes },
    subcategories: { inserts: subInserts, updates: subUpdates, deletes: subDeletes },
    links: { inserts: linkInserts, updates: linkUpdates, deletes: linkDeletes },
    isEmpty,
  };
}

// Apply a diff in a single D1 batch (one transaction). Statement ordering
// matters because D1 runs the array in order and we rely on ON DELETE
// CASCADE for orphan cleanup:
//
//   1. Parent INSERTs (cat, sub) — so subsequent UPDATEs/INSERTs can target
//      newly-created parents.
//   2. UPDATEs (cat, sub, link) — must run BEFORE any DELETEs, otherwise a
//      link being moved out of a sub that is also being deleted would be
//      cascade-eaten before the UPDATE could rescue it.
//   3. Link INSERTs — after sub INSERTs (FK).
//   4. DELETEs in child→parent order (link, sub, cat). Explicit link/sub
//      deletes only fire when their parent survives; everything else is
//      handled by cascade.
//
// Link UPDATEs never touch visit_count, so counters survive edits — that's
// the headline behavioral change vs the old writeAllCategories wipe.
export async function applyCategoryDiff(db: D1, diff: CategoryDiff): Promise<void> {
  if (diff.isEmpty) return;

  const stmts: any[] = [];

  // --- 1. Parent INSERTs ---
  for (const i of diff.categories.inserts) {
    stmts.push(
      db
        .prepare("INSERT INTO categories (id, title, position) VALUES (?, ?, ?)")
        .bind(i.id, i.title, i.position)
    );
  }
  for (const i of diff.subcategories.inserts) {
    stmts.push(
      db
        .prepare("INSERT INTO subcategories (id, category_id, title, position) VALUES (?, ?, ?, ?)")
        .bind(i.id, i.categoryId, i.title, i.position)
    );
  }

  // --- 2. UPDATEs (must precede DELETEs to survive cascade) ---
  for (const u of diff.categories.updates) {
    const sets: string[] = [];
    const binds: any[] = [];
    if (u.title !== undefined) {
      sets.push("title = ?");
      binds.push(u.title);
    }
    if (u.position !== undefined) {
      sets.push("position = ?");
      binds.push(u.position);
    }
    binds.push(u.id);
    stmts.push(db.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`).bind(...binds));
  }
  for (const u of diff.subcategories.updates) {
    const sets: string[] = [];
    const binds: any[] = [];
    if (u.categoryId !== undefined) {
      sets.push("category_id = ?");
      binds.push(u.categoryId);
    }
    if (u.title !== undefined) {
      sets.push("title = ?");
      binds.push(u.title);
    }
    if (u.position !== undefined) {
      sets.push("position = ?");
      binds.push(u.position);
    }
    binds.push(u.id);
    stmts.push(
      db.prepare(`UPDATE subcategories SET ${sets.join(", ")} WHERE id = ?`).bind(...binds)
    );
  }
  for (const u of diff.links.updates) {
    const sets: string[] = [];
    const binds: any[] = [];
    if (u.subcategoryId !== undefined) {
      sets.push("subcategory_id = ?");
      binds.push(u.subcategoryId);
    }
    if (u.title !== undefined) {
      sets.push("title = ?");
      binds.push(u.title);
    }
    if (u.url !== undefined) {
      sets.push("url = ?");
      binds.push(u.url);
    }
    if (u.description !== undefined) {
      sets.push("description = ?");
      binds.push(u.description);
    }
    if (u.icon !== undefined) {
      sets.push("icon = ?");
      binds.push(u.icon);
    }
    if (u.position !== undefined) {
      sets.push("position = ?");
      binds.push(u.position);
    }
    binds.push(u.id);
    stmts.push(db.prepare(`UPDATE links SET ${sets.join(", ")} WHERE id = ?`).bind(...binds));
  }

  // --- 3. Link INSERTs (after sub inserts so FK targets exist) ---
  for (const i of diff.links.inserts) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO links (id, subcategory_id, title, url, description, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(i.id, i.subcategoryId, i.title, i.url, i.description, i.icon, i.position)
    );
  }

  // --- 4. DELETEs in child→parent order ---
  for (const d of diff.links.deletes) {
    stmts.push(db.prepare("DELETE FROM links WHERE id = ?").bind(d));
  }
  for (const d of diff.subcategories.deletes) {
    stmts.push(db.prepare("DELETE FROM subcategories WHERE id = ?").bind(d));
  }
  for (const d of diff.categories.deletes) {
    stmts.push(db.prepare("DELETE FROM categories WHERE id = ?").bind(d));
  }

  if (stmts.length > 0) await db.batch(stmts);
}

// Full replace via batch: wipe + insert in one D1 batch. Retained as the
// migration / reset path and as a fallback if a diff ever looks unsafe.
export async function writeAllCategories(db: D1, categories: Category[]): Promise<void> {
  const stmts: any[] = [
    db.prepare("DELETE FROM links"),
    db.prepare("DELETE FROM subcategories"),
    db.prepare("DELETE FROM categories"),
  ];

  categories.forEach((cat, ci) => {
    stmts.push(
      db
        .prepare("INSERT INTO categories (id, title, position) VALUES (?, ?, ?)")
        .bind(cat.id, cat.title, ci)
    );
    cat.subCategories?.forEach((sub, si) => {
      stmts.push(
        db
          .prepare(
            "INSERT INTO subcategories (id, category_id, title, position) VALUES (?, ?, ?, ?)"
          )
          .bind(sub.id, cat.id, sub.title, si)
      );
      sub.items?.forEach((link, li) => {
        stmts.push(
          db
            .prepare(
              "INSERT INTO links (id, subcategory_id, title, url, description, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(
              link.id,
              sub.id,
              link.title,
              link.url,
              link.description ?? null,
              link.icon ?? null,
              li
            )
        );
      });
    });
  });

  if (stmts.length > 3) await db.batch(stmts);
  else await db.batch(stmts.slice(0, 3));
}

// ---------------------------------------------------------------------------
// Config reads
// ---------------------------------------------------------------------------

export interface BootstrapConfig {
  background: string;
  prefs: UserPreferences;
  isDefaultCode: boolean;
}

export async function getKVConfig(db: D1): Promise<{ background: string; prefs: UserPreferences }> {
  const { results } = await db
    .prepare("SELECT key, value FROM config WHERE key IN ('background', 'prefs')")
    .all<{ key: string; value: string }>();
  return parseKVConfig(results ?? []);
}

function parseKVConfig(rows: { key: string; value: string }[]): {
  background: string;
  prefs: UserPreferences;
} {
  const map = new Map<string, string>();
  rows.forEach((r) => map.set(r.key, r.value));

  let background: string = map.get("background") || DEFAULT_BACKGROUND;
  if (typeof background !== "string" || !background) background = DEFAULT_BACKGROUND;

  let prefs: UserPreferences = DEFAULT_PREFS;
  const rawPrefs = map.get("prefs");
  if (rawPrefs) {
    try {
      const parsed = JSON.parse(rawPrefs);
      if (parsed && typeof parsed === "object") prefs = parsed;
    } catch (e) {
      console.warn("prefs JSON parse failed", e);
    }
  }

  return { background, prefs };
}

// Single-query read that the bootstrap endpoint needs. Replaces the previous
// 2-call sequence (getKVConfig + isDefaultAuthCode).
export async function getBootstrapConfig(db: D1): Promise<BootstrapConfig> {
  const { results } = await db
    .prepare("SELECT key, value FROM config WHERE key IN ('background', 'prefs', 'auth_code')")
    .all<{ key: string; value: string }>();

  const map = new Map<string, string>();
  results?.forEach((r: { key: string; value: string }) => map.set(r.key, r.value));

  const kvRows: { key: string; value: string }[] = [];
  if (map.has("background")) kvRows.push({ key: "background", value: map.get("background")! });
  if (map.has("prefs")) kvRows.push({ key: "prefs", value: map.get("prefs")! });
  const { background, prefs } = parseKVConfig(kvRows);

  const authCode = map.get("auth_code");
  const isDefaultCode = !authCode || authCode === "admin";

  return { background, prefs, isDefaultCode };
}

export async function isDefaultAuthCode(db: D1): Promise<boolean> {
  const row = await db
    .prepare("SELECT value FROM config WHERE key = 'auth_code'")
    .first<{ value: string }>();
  return !row?.value || row.value === "admin";
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function getDefaultCategories(): Category[] {
  return DEFAULT_CATEGORIES;
}

export function getDefaultBackground(): string {
  return DEFAULT_BACKGROUND;
}

export function getDefaultPrefs(): UserPreferences {
  return DEFAULT_PREFS;
}
