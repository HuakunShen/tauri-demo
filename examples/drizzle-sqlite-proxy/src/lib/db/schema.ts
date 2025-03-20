import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey().unique(),
  created_at: text("created_at").default("CURRENT_TIMESTAMP"),
  name: text("name"),
});
