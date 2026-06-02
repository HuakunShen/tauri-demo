import { describe, expect, test } from "bun:test";
import { getConnectorPath } from "./connector-path";

describe("getConnectorPath", () => {
  test("uses cubic Bezier paths for horizontal connector directions", () => {
    const left = getConnectorPath("left");
    const right = getConnectorPath("right");

    expect(left.viewBox).toBe("0 0 48 24");
    expect(right.viewBox).toBe("0 0 48 24");
    expect(left.path).toContain("C");
    expect(right.path).toContain("C");
    expect(left.start).toEqual({ cx: 1, cy: 12 });
    expect(right.end).toEqual({ cx: 1, cy: 12 });
  });

  test("uses cubic Bezier paths for vertical fallback directions", () => {
    const top = getConnectorPath("top");
    const bottom = getConnectorPath("bottom");

    expect(top.viewBox).toBe("0 0 24 48");
    expect(bottom.viewBox).toBe("0 0 24 48");
    expect(top.path).toContain("C");
    expect(bottom.path).toContain("C");
    expect(top.end).toEqual({ cx: 12, cy: 47 });
    expect(bottom.start).toEqual({ cx: 12, cy: 47 });
  });
});
