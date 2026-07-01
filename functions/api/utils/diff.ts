import type { Category } from "../../../src/types";
import type { D1 } from "./schema";

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
    if (cats.has(cat.id)) {
      console.warn(`flattenCategories: duplicate category id "${cat.id}", skipping`);
      return;
    }
    cats.set(cat.id, { title: cat.title, position: ci });
    cat.subCategories?.forEach((sub, si) => {
      if (subs.has(sub.id)) {
        console.warn(`flattenCategories: duplicate subcategory id "${sub.id}", skipping`);
        return;
      }
      subs.set(sub.id, { categoryId: cat.id, title: sub.title, position: si });
      sub.items?.forEach((link, li) => {
        if (links.has(link.id)) {
          console.warn(`flattenCategories: duplicate link id "${link.id}", skipping`);
          return;
        }
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
  for (const id of cur.subs.keys()) {
    if (nxt.subs.has(id)) continue;
    const curRow = cur.subs.get(id)!;
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

export async function applyCategoryDiff(db: D1, diff: CategoryDiff): Promise<void> {
  if (diff.isEmpty) return;

  const stmts: D1PreparedStatement[] = [];

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
    const binds: (string | number)[] = [];
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
    const binds: (string | number)[] = [];
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
    const binds: (string | number | null)[] = [];
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
