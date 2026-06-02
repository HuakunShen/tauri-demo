import type { ClipboardItem } from "./clipboard-mock";
import type { ItemRect, PreviewPlacement, ViewportSize } from "./geometry";

export const PREVIEW_HOVER_EVENT = "preview:hover";
export const PREVIEW_HIDE_EVENT = "preview:hide";

export type PreviewHoverPayload = {
  item: ClipboardItem;
  itemRect: ItemRect;
  viewport: ViewportSize;
  placement: PreviewPlacement;
};

export function createPreviewHoverPayload(
  item: ClipboardItem,
  element: HTMLElement,
  placement: PreviewPlacement,
): PreviewHoverPayload {
  const rect = element.getBoundingClientRect();

  return {
    item,
    itemRect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    placement,
  };
}
