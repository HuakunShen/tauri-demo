import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "sqlite:test.db",
  },
  verbose: false,
  strict: true,
  out: "./src-tauri/migrations",
});
