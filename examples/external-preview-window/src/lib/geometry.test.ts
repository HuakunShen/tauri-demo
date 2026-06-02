import { describe, expect, test } from "bun:test";
import {
  PREVIEW_CARD_HEIGHT,
  PREVIEW_PADDING,
  computePreviewGeometry,
} from "./geometry";

describe("computePreviewGeometry", () => {
  test("centers the preview card on the hovered item and keeps the connector on the item center", () => {
    const geometry = computePreviewGeometry({
      itemRect: { top: 220, left: 16, width: 380, height: 56 },
      viewport: { width: 420, height: 680 },
    });

    expect(geometry.targetY).toBe(248 - PREVIEW_CARD_HEIGHT / 2);
    expect(geometry.connectorY).toBe(248);
    expect(geometry.attachYWithinCard).toBe(PREVIEW_CARD_HEIGHT / 2);
  });

  test("clamps the preview card inside the preview window while keeping the connector aligned", () => {
    const topGeometry = computePreviewGeometry({
      itemRect: { top: 12, left: 16, width: 380, height: 44 },
      viewport: { width: 420, height: 680 },
    });

    expect(topGeometry.targetY).toBe(PREVIEW_PADDING);
    expect(topGeometry.connectorY).toBe(34);
    expect(topGeometry.attachYWithinCard).toBe(24);

    const bottomGeometry = computePreviewGeometry({
      itemRect: { top: 624, left: 16, width: 380, height: 48 },
      viewport: { width: 420, height: 680 },
    });

    expect(bottomGeometry.targetY).toBe(
      680 - PREVIEW_CARD_HEIGHT - PREVIEW_PADDING,
    );
    expect(bottomGeometry.connectorY).toBe(648);
    expect(bottomGeometry.attachYWithinCard).toBe(PREVIEW_CARD_HEIGHT - 24);
  });
});
