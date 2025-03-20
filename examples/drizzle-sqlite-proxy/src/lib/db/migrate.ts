import { getDb } from "./database";
import { migrations } from "./migrations";

export type ProxyMigrator = (migrationQueries: string[]) => Promise<void>;

/**
 * Executes database migrations.
 *
 * @param db The database instance.
 * @returns A promise that resolves when the migrations are complete.
 */
export async function migrate() {
  const sqlite = await getDb();

  const migrationTableCreate = /*sql*/ `
		CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash text NOT NULL UNIQUE,
			created_at numeric
		)
	`;

  await sqlite.execute(migrationTableCreate, []);

  for (const migration of migrations) {
    // const hash = migration.name?.replace(".sql", "");

    const dbMigrations = (await sqlite.select(
      /*sql*/ `SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY created_at DESC`
    )) as unknown as { id: number; hash: string; created_at: number }[];

    const hasBeenRun = (hash: string) =>
      dbMigrations.find((dbMigration) => {
        return dbMigration?.hash === hash;
      });

    if (hasBeenRun(migration.name) === undefined) {
      // const filePath = await join(resourcePath, "migrations", migration.name);
      // const sql = await readTextFile(filePath);

      sqlite.execute(migration.sql, []);
      sqlite.execute(
        /*sql*/ `INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
        [migration.name, Date.now()]
      );
    }
  }

  console.info("Migrations complete");
  await sqlite.close();
  return Promise.resolve();
}
