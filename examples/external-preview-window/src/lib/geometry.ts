export const PREVIEW_PADDING = 16;
export const PREVIEW_CARD_WIDTH = 640;
export const PREVIEW_CARD_HEIGHT = 360;
export const CONNECTOR_WIDTH = 48;
export const GAP_BETWEEN_CARD_AND_HISTORY = 12;
export const PREVIEW_WINDOW_WIDTH =
  PREVIEW_PADDING +
  PREVIEW_CARD_WIDTH +
  CONNECTOR_WIDTH +
  GAP_BETWEEN_CARD_AND_HISTORY;
export const VERTICAL_PREVIEW_WINDOW_WIDTH =
  PREVIEW_PADDING + PREVIEW_CARD_WIDTH + PREVIEW_PADDING;
export const VERTICAL_PREVIEW_WINDOW_HEIGHT =
  PREVIEW_PADDING +
  PREVIEW_CARD_HEIGHT +
  CONNECTOR_WIDTH +
  GAP_BETWEEN_CARD_AND_HISTORY;

export type PreviewPlacementDirection = "left" | "right" | "top" | "bottom";

export type PreviewPlacement = {
  direction: PreviewPlacementDirection;
  windowWidth: number;
  windowHeight: number;
};

export type ItemRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type PreviewGeometryInput = {
  itemRect: ItemRect;
  viewport: ViewportSize;
  placement?: PreviewPlacement;
};

export type PreviewGeometry = {
  targetX: number;
  targetY: number;
  connectorX: number;
  connectorY: number;
  attachXWithinCard: number;
  attachYWithinCard: number;
};

export function computePreviewGeometry(
  input: PreviewGeometryInput,
): PreviewGeometry {
  const placement = input.placement ?? {
    direction: "left",
    windowWidth: PREVIEW_WINDOW_WIDTH,
    windowHeight: input.viewport.height,
  };
  const hoveredCenterY = input.itemRect.top + input.itemRect.height / 2;
  const hoveredCenterX = input.itemRect.left + input.itemRect.width / 2;

  if (placement.direction === "top" || placement.direction === "bottom") {
    const targetX = clamp(
      placement.windowWidth / 2 - PREVIEW_CARD_WIDTH / 2,
      PREVIEW_PADDING,
      placement.windowWidth - PREVIEW_CARD_WIDTH - PREVIEW_PADDING,
    );
    const targetY =
      placement.direction === "top"
        ? PREVIEW_PADDING
        : CONNECTOR_WIDTH + GAP_BETWEEN_CARD_AND_HISTORY;
    const connectorX = clamp(
      hoveredCenterX + (placement.windowWidth - input.viewport.width) / 2,
      PREVIEW_PADDING + 24,
      placement.windowWidth - PREVIEW_PADDING - 24,
    );

    return {
      targetX,
      targetY,
      connectorX,
      connectorY:
        placement.direction === "top"
          ? PREVIEW_PADDING + PREVIEW_CARD_HEIGHT
          : GAP_BETWEEN_CARD_AND_HISTORY,
      attachXWithinCard: clamp(
        connectorX - targetX,
        24,
        PREVIEW_CARD_WIDTH - 24,
      ),
      attachYWithinCard:
        placement.direction === "top" ? PREVIEW_CARD_HEIGHT - 24 : 24,
    };
  }

  const targetX =
    placement.direction === "right"
      ? GAP_BETWEEN_CARD_AND_HISTORY + CONNECTOR_WIDTH
      : PREVIEW_PADDING;
  const targetY = clamp(
    hoveredCenterY - PREVIEW_CARD_HEIGHT / 2,
    PREVIEW_PADDING,
    placement.windowHeight - PREVIEW_CARD_HEIGHT - PREVIEW_PADDING,
  );

  return {
    targetX,
    targetY,
    connectorX:
      placement.direction === "right"
        ? GAP_BETWEEN_CARD_AND_HISTORY
        : PREVIEW_PADDING + PREVIEW_CARD_WIDTH,
    connectorY: hoveredCenterY,
    attachXWithinCard:
      placement.direction === "right" ? 24 : PREVIEW_CARD_WIDTH - 24,
    attachYWithinCard: clamp(
      hoveredCenterY - targetY,
      24,
      PREVIEW_CARD_HEIGHT - 24,
    ),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
