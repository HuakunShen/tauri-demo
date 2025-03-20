import m1 from "../../../src-tauri/migrations/0000_strong_black_bird.sql?raw";

export const migrations = [
  {
    name: "init",
    sql: m1,
  },
];
