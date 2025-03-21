# Tauri + SurrealDB

SurrealDB is very powerful.
Since it's written in Rust, we can embed it in a Tauri app.

## App Size

However, it introduces much higher bundle size compared to sqlite integration.

| Condition        | App Size (.dmg) | App Size (.app) |
| ---------------- | --------------- | --------------- |
| Before SurrealDB | 2.9MB           | 8.3MB           |
| After SurrealDB  | 19MB            | 54MB            |

FYI, in the other example [Tauri + Drizzle Proxy](../drizzle-sqlite-proxy/), the app size is 13MB (.app) and 4.8MB (.dmg).

So roughly,

- sqlite integration introduced extra 13-8=5MB and surrealdb introduced extra 54-8=46MB.
- `.dmg` files are compressed. Sqlite integration introduced extra 4.8-2.9=1.9MB and surrealdb introduced extra 19-2.9=16.1MB.

Surrealdb has much more features than sqlite, so there is a trade-off here.
Do you need all features of Surrealdb?

If you want a minimal app, you should use sqlite.

But the size increase is honestly not considered as a big deal today, all the apps are bloated.
Electron apps are typically 200-400MB.

But developers using Tauri may want a minimal app size. You can decide for yourself.
