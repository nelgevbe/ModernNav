import type { Category } from "../../../src/types";
import type { D1 } from "./schema";

export async function writeAllCategories(db: D1, categories: Category[]): Promise<void> {
  const stmts: D1PreparedStatement[] = [
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
