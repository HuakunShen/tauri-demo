import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { currentMonitor } from "@tauri-apps/api/window";
import {
  PREVIEW_WINDOW_WIDTH,
  VERTICAL_PREVIEW_WINDOW_HEIGHT,
  VERTICAL_PREVIEW_WINDOW_WIDTH,
  type PreviewPlacementDirection,
} from "./geometry";

export const HISTORY_WINDOW_WIDTH = 420;
export const HISTORY_WINDOW_HEIGHT = 680;

type WindowWithGeometry = {
  outerPosition: () => Promise<{
    toLogical: (scaleFactor: number) => { x: number; y: number };
  }>;
  outerSize: () => Promise<{
    toLogical: (scaleFactor: number) => { width: number; height: number };
  }>;
  scaleFactor: () => Promise<number>;
};

type PreviewWindowControls = {
  setPosition: (position: LogicalPosition) => Promise<void>;
  setSize: (size: LogicalSize) => Promise<void>;
};

type LogicalWindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreviewWindowLayout = LogicalWindowRect & {
  direction: PreviewPlacementDirection;
};

type ComputePreviewWindowLayoutInput = {
  history: LogicalWindowRect;
  workArea?: LogicalWindowRect;
};

export const SCREEN_EDGE_MARGIN = 12;

export function computePreviewWindowLayout({
  history,
  workArea = {
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
    width: Number.POSITIVE_INFINITY,
    height: Number.POSITIVE_INFINITY,
  },
}: ComputePreviewWindowLayoutInput): PreviewWindowLayout {
  const workRight = workArea.x + workArea.width;
  const workBottom = workArea.y + workArea.height;
  const historyRight = history.x + history.width;
  const historyBottom = history.y + history.height;
  const leftSpace = history.x - workArea.x;
  const rightSpace = workRight - historyRight;
  const topSpace = history.y - workArea.y;
  const bottomSpace = workBottom - historyBottom;
  const sideHeight = Math.min(history.height, workArea.height - SCREEN_EDGE_MARGIN * 2);

  if (leftSpace >= PREVIEW_WINDOW_WIDTH + SCREEN_EDGE_MARGIN) {
    return {
      direction: "left",
      x: history.x - PREVIEW_WINDOW_WIDTH,
      y: clamp(
        history.y,
        workArea.y + SCREEN_EDGE_MARGIN,
        workBottom - sideHeight - SCREEN_EDGE_MARGIN,
      ),
      width: PREVIEW_WINDOW_WIDTH,
      height: sideHeight,
    };
  }

  if (rightSpace >= PREVIEW_WINDOW_WIDTH + SCREEN_EDGE_MARGIN) {
    return {
      direction: "right",
      x: historyRight,
      y: clamp(
        history.y,
        workArea.y + SCREEN_EDGE_MARGIN,
        workBottom - sideHeight - SCREEN_EDGE_MARGIN,
      ),
      width: PREVIEW_WINDOW_WIDTH,
      height: sideHeight,
    };
  }

  if (topSpace >= VERTICAL_PREVIEW_WINDOW_HEIGHT + SCREEN_EDGE_MARGIN) {
    return {
      direction: "top",
      x: clamp(
        history.x + history.width / 2 - VERTICAL_PREVIEW_WINDOW_WIDTH / 2,
        workArea.x + SCREEN_EDGE_MARGIN,
        workRight - VERTICAL_PREVIEW_WINDOW_WIDTH - SCREEN_EDGE_MARGIN,
      ),
      y: history.y - VERTICAL_PREVIEW_WINDOW_HEIGHT,
      width: VERTICAL_PREVIEW_WINDOW_WIDTH,
      height: VERTICAL_PREVIEW_WINDOW_HEIGHT,
    };
  }

  if (bottomSpace >= VERTICAL_PREVIEW_WINDOW_HEIGHT + SCREEN_EDGE_MARGIN) {
    return {
      direction: "bottom",
      x: clamp(
        history.x + history.width / 2 - VERTICAL_PREVIEW_WINDOW_WIDTH / 2,
        workArea.x + SCREEN_EDGE_MARGIN,
        workRight - VERTICAL_PREVIEW_WINDOW_WIDTH - SCREEN_EDGE_MARGIN,
      ),
      y: historyBottom,
      width: VERTICAL_PREVIEW_WINDOW_WIDTH,
      height: VERTICAL_PREVIEW_WINDOW_HEIGHT,
    };
  }

  const bestDirection = chooseBestFallbackDirection({
    left: leftSpace,
    right: rightSpace,
    top: topSpace,
    bottom: bottomSpace,
  });

  if (bestDirection === "top" || bestDirection === "bottom") {
    return {
      direction: bestDirection,
      x: clamp(
        history.x + history.width / 2 - VERTICAL_PREVIEW_WINDOW_WIDTH / 2,
        workArea.x + SCREEN_EDGE_MARGIN,
        workRight - VERTICAL_PREVIEW_WINDOW_WIDTH - SCREEN_EDGE_MARGIN,
      ),
      y: clamp(
        bestDirection === "top"
          ? history.y - VERTICAL_PREVIEW_WINDOW_HEIGHT
          : historyBottom,
        workArea.y + SCREEN_EDGE_MARGIN,
        workBottom - VERTICAL_PREVIEW_WINDOW_HEIGHT - SCREEN_EDGE_MARGIN,
      ),
      width: VERTICAL_PREVIEW_WINDOW_WIDTH,
      height: VERTICAL_PREVIEW_WINDOW_HEIGHT,
    };
  }

  return {
    direction: bestDirection,
    x: clamp(
      bestDirection === "left"
        ? history.x - PREVIEW_WINDOW_WIDTH
        : historyRight,
      workArea.x + SCREEN_EDGE_MARGIN,
      workRight - PREVIEW_WINDOW_WIDTH - SCREEN_EDGE_MARGIN,
    ),
    y: clamp(
      history.y,
      workArea.y + SCREEN_EDGE_MARGIN,
      workBottom - sideHeight - SCREEN_EDGE_MARGIN,
    ),
    width: PREVIEW_WINDOW_WIDTH,
    height: sideHeight,
  };
}

export async function syncPreviewWindowPosition(
  history: WindowWithGeometry,
  preview: PreviewWindowControls,
) {
  const [scaleFactor, position, size, monitor] = await Promise.all([
    history.scaleFactor(),
    history.outerPosition(),
    history.outerSize(),
    currentMonitor(),
  ]);
  const logicalPosition = position.toLogical(scaleFactor);
  const logicalSize = size.toLogical(scaleFactor);
  const logicalWorkArea = monitor
    ? {
        x: monitor.workArea.position.toLogical(monitor.scaleFactor).x,
        y: monitor.workArea.position.toLogical(monitor.scaleFactor).y,
        width: monitor.workArea.size.toLogical(monitor.scaleFactor).width,
        height: monitor.workArea.size.toLogical(monitor.scaleFactor).height,
      }
    : undefined;
  const previewLayout = computePreviewWindowLayout({
    history: {
      x: logicalPosition.x,
      y: logicalPosition.y,
      width: logicalSize.width,
      height: logicalSize.height,
    },
    workArea: logicalWorkArea,
  });

  await preview.setSize(
    new LogicalSize(previewLayout.width, previewLayout.height),
  );
  await preview.setPosition(
    new LogicalPosition(previewLayout.x, previewLayout.y),
  );

  return previewLayout;
}

function chooseBestFallbackDirection(spaces: Record<PreviewPlacementDirection, number>) {
  return Object.entries(spaces).reduce<PreviewPlacementDirection>(
    (best, [direction, space]) =>
      space > spaces[best] ? (direction as PreviewPlacementDirection) : best,
    "left",
  );
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
