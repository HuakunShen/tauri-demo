import { describe, expect, test } from "bun:test";
import {
  GAP_BETWEEN_CARD_AND_HISTORY,
  CONNECTOR_WIDTH,
  PREVIEW_CARD_HEIGHT,
  PREVIEW_CARD_WIDTH,
  PREVIEW_PADDING,
  VERTICAL_PREVIEW_WINDOW_HEIGHT,
  VERTICAL_PREVIEW_WINDOW_WIDTH,
  PREVIEW_WINDOW_WIDTH,
} from "./geometry";
import {
  SCREEN_EDGE_MARGIN,
  computePreviewWindowLayout,
} from "./window-layout";

const workArea = {
  x: 0,
  y: 0,
  width: 1440,
  height: 900,
};

describe("computePreviewWindowLayout", () => {
  test("positions the preview window to the left of history when that side has room", () => {
    const layout = computePreviewWindowLayout({
      history: {
        x: 900,
        y: 120,
        width: 420,
        height: 680,
      },
      workArea,
    });

    expect(layout).toEqual({
      x: 900 - PREVIEW_WINDOW_WIDTH,
      y: 120,
      width: PREVIEW_WINDOW_WIDTH,
      height: 680,
      direction: "left",
    });
  });

  test("moves the preview window to the right when the history window is near the left edge", () => {
    const layout = computePreviewWindowLayout({
      history: {
        x: 12,
        y: 120,
        width: 420,
        height: 680,
      },
      workArea,
    });

    expect(layout.direction).toBe("right");
    expect(layout.x).toBe(12 + 420);
    expect(layout.width).toBe(PREVIEW_WINDOW_WIDTH);
  });

  test("uses a vertical placement when neither horizontal side has enough room", () => {
    const layout = computePreviewWindowLayout({
      history: {
        x: 390,
        y: 560,
        width: 420,
        height: 240,
      },
      workArea: {
        x: 0,
        y: 0,
        width: 900,
        height: 900,
      },
    });

    expect(layout.direction).toBe("top");
    expect(layout.width).toBe(VERTICAL_PREVIEW_WINDOW_WIDTH);
    expect(layout.height).toBe(VERTICAL_PREVIEW_WINDOW_HEIGHT);
    expect(layout.y).toBe(560 - VERTICAL_PREVIEW_WINDOW_HEIGHT);
  });

  test("clamps preview windows inside the monitor work area", () => {
    const layout = computePreviewWindowLayout({
      history: {
        x: 12,
        y: 8,
        width: 420,
        height: 680,
      },
      workArea,
    });

    expect(layout.direction).toBe("right");
    expect(layout.y).toBe(SCREEN_EDGE_MARGIN);
  });

  test("keeps a transparent gap after the connector so the history window does not cover the line", () => {
    const connectorRight =
      PREVIEW_PADDING + PREVIEW_CARD_WIDTH + CONNECTOR_WIDTH;

    expect(PREVIEW_WINDOW_WIDTH - connectorRight).toBe(
      GAP_BETWEEN_CARD_AND_HISTORY,
    );
    expect(VERTICAL_PREVIEW_WINDOW_HEIGHT).toBe(
      PREVIEW_PADDING +
        PREVIEW_CARD_HEIGHT +
        CONNECTOR_WIDTH +
        GAP_BETWEEN_CARD_AND_HISTORY,
    );
  });
});
