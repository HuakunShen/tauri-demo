import { useEffect, useRef, useState, type CSSProperties } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ConnectorLine } from "../components/ConnectorLine";
import { PreviewCard } from "../components/PreviewCard";
import type { ClipboardItem } from "../lib/clipboard-mock";
import { computePreviewGeometry } from "../lib/geometry";
import type { PreviewPlacementDirection } from "../lib/geometry";
import {
  PREVIEW_HIDE_EVENT,
  PREVIEW_HOVER_EVENT,
  type PreviewHoverPayload,
} from "../lib/preview-events";

type PreviewState = {
  visible: boolean;
  item: ClipboardItem | null;
  direction: PreviewPlacementDirection;
  targetX: number;
  targetY: number;
  connectorX: number;
  connectorY: number;
  attachXWithinCard: number;
  attachYWithinCard: number;
};

const initialState: PreviewState = {
  visible: false,
  item: null,
  direction: "left",
  targetX: 16,
  targetY: 120,
  connectorX: 656,
  connectorY: 180,
  attachXWithinCard: 616,
  attachYWithinCard: 180,
};

export function PreviewWindow() {
  const [state, setState] = useState<PreviewState>(initialState);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlistenHover: (() => void) | undefined;
    let unlistenHide: (() => void) | undefined;

    async function setupPreview() {
      const preview = getCurrentWindow();

      await Promise.allSettled([
        preview.setIgnoreCursorEvents(true),
        preview.setFocusable(false),
        preview.setAlwaysOnTop(true),
        preview.setSkipTaskbar(true),
      ]);

      unlistenHover = await listen<PreviewHoverPayload>(
        PREVIEW_HOVER_EVENT,
        (event) => {
          if (disposed) return;

          if (hideTimer.current !== null) {
            clearTimeout(hideTimer.current);
            hideTimer.current = null;
          }

          const geometry = computePreviewGeometry(event.payload);
          void preview.show();

          setState({
            visible: true,
            item: event.payload.item,
            direction: event.payload.placement.direction,
            targetX: geometry.targetX,
            targetY: geometry.targetY,
            connectorX: geometry.connectorX,
            connectorY: geometry.connectorY,
            attachXWithinCard: geometry.attachXWithinCard,
            attachYWithinCard: geometry.attachYWithinCard,
          });
        },
      );

      unlistenHide = await listen(PREVIEW_HIDE_EVENT, () => {
        if (disposed) return;

        setState((current) => ({
          ...current,
          visible: false,
        }));

        hideTimer.current = window.setTimeout(() => {
          void preview.hide();
        }, 140);
      });
    }

    void setupPreview().catch((error: unknown) => {
      console.warn("Preview listener setup failed", error);
    });

    return () => {
      disposed = true;
      unlistenHover?.();
      unlistenHide?.();

      if (hideTimer.current !== null) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  return (
    <div
      className="preview-layer"
      data-placement={state.direction}
      style={
        {
          "--preview-x": `${state.targetX}px`,
          "--preview-y": `${state.targetY}px`,
          "--connector-x": `${state.connectorX}px`,
          "--connector-y": `${state.connectorY}px`,
          "--attach-x": `${state.attachXWithinCard}px`,
          "--attach-y": `${state.attachYWithinCard}px`,
          "--card-opacity": state.visible ? 1 : 0,
          "--connector-opacity": state.visible ? 1 : 0,
          "--card-scale": state.visible ? 1 : 0.985,
        } as CSSProperties
      }
    >
      <PreviewCard item={state.item} />
      <ConnectorLine direction={state.direction} />
    </div>
  );
}
