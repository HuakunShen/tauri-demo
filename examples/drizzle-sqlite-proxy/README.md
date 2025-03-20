This demo let you use drizzle to control your sqlite DB in a Tauri app, without any sidecar.

This is a Tauri v2 reproduction for the archived repo https://github.com/tdwesten/tauri-drizzle-sqlite-proxy-demo

When schema updates, generate migration and import the migration files to `migrations.ts`

```bash
npx drizzle-kit generate
```

