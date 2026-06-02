import type { PreviewPlacementDirection } from "./geometry";

type ConnectorPoint = {
  cx: number;
  cy: number;
};

type ConnectorPath = {
  viewBox: string;
  path: string;
  start: ConnectorPoint;
  end: ConnectorPoint;
};

export function getConnectorPath(
  direction: PreviewPlacementDirection,
): ConnectorPath {
  if (direction === "right") {
    return {
      viewBox: "0 0 48 24",
      path: "M 47 12 C 36 12 34 5 24 5 C 14 5 12 12 1 12",
      start: { cx: 47, cy: 12 },
      end: { cx: 1, cy: 12 },
    };
  }

  if (direction === "top") {
    return {
      viewBox: "0 0 24 48",
      path: "M 12 1 C 12 12 19 14 19 24 C 19 34 12 36 12 47",
      start: { cx: 12, cy: 1 },
      end: { cx: 12, cy: 47 },
    };
  }

  if (direction === "bottom") {
    return {
      viewBox: "0 0 24 48",
      path: "M 12 47 C 12 36 5 34 5 24 C 5 14 12 12 12 1",
      start: { cx: 12, cy: 47 },
      end: { cx: 12, cy: 1 },
    };
  }

  return {
    viewBox: "0 0 48 24",
    path: "M 1 12 C 12 12 14 5 24 5 C 34 5 36 12 47 12",
    start: { cx: 1, cy: 12 },
    end: { cx: 47, cy: 12 },
  };
}
