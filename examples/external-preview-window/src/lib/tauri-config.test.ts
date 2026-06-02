import { describe, expect, test } from "bun:test";

describe("Tauri window capabilities", () => {
  test("allows frameless history window dragging", async () => {
    const capability = await Bun.file(
      "src-tauri/capabilities/clipboard-preview.json",
    ).json();

    expect(capability.windows).toContain("history");
    expect(capability.permissions).toContain(
      "core:window:allow-start-dragging",
    );
  });
});
