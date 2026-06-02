import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { clipboardItems, type ClipboardItemType } from "../lib/clipboard-mock";
import {
  PREVIEW_WINDOW_WIDTH,
  type PreviewPlacement,
} from "../lib/geometry";
import { PREVIEW_HIDE_EVENT, PREVIEW_HOVER_EVENT, createPreviewHoverPayload } from "../lib/preview-events";
import { syncPreviewWindowPosition } from "../lib/window-layout";
import { HistoryItem } from "../components/HistoryItem";

const filterOptions: Array<{ label: string; value: ClipboardItemType | "all" }> =
  [
    { label: "All", value: "all" },
    { label: "Text", value: "text" },
    { label: "Images", value: "image" },
    { label: "Files", value: "file" },
  ];

type PendingHover = {
  itemId: string;
  element: HTMLElement;
};

export function HistoryWindow() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClipboardItemType | "all">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const pendingHover = useRef<PendingHover | null>(null);
  const rafId = useRef<number | null>(null);
  const placement = useRef<PreviewPlacement>({
    direction: "left",
    windowWidth: PREVIEW_WINDOW_WIDTH,
    windowHeight: window.innerHeight,
  });

  useEffect(() => {
    let disposed = false;
    let disposeMove: (() => void) | undefined;
    let disposeResize: (() => void) | undefined;

    async function setupPreviewWindow() {
      const history = getCurrentWindow();
      const preview = await WebviewWindow.getByLabel("preview");

      if (!preview || disposed) return;

      await Promise.allSettled([
        preview.setFocusable(false),
        preview.setAlwaysOnTop(true),
        preview.setSkipTaskbar(true),
        preview.setIgnoreCursorEvents(true),
      ]);
      placement.current = toPreviewPlacement(
        await syncPreviewWindowPosition(history, preview),
      );

      disposeMove = await history.onMoved(() => {
        void syncPreviewWindowPosition(history, preview).then((layout) => {
          placement.current = toPreviewPlacement(layout);
        });
      });
      disposeResize = await history.onResized(() => {
        void syncPreviewWindowPosition(history, preview).then((layout) => {
          placement.current = toPreviewPlacement(layout);
        });
      });
    }

    void setupPreviewWindow().catch((error: unknown) => {
      console.warn("Preview window setup failed", error);
    });

    return () => {
      disposed = true;
      disposeMove?.();
      disposeResize?.();

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return clipboardItems.filter((item) => {
      const matchesFilter = filter === "all" || item.type === filter;
      const haystack = [
        item.title,
        item.subtitle,
        item.createdAt,
        item.previewText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && haystack.includes(normalizedQuery);
    });
  }, [filter, query]);

  const scheduleHover = useCallback(
    (itemId: string, element: HTMLElement) => {
      pendingHover.current = { itemId, element };

      if (rafId.current !== null) return;

      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;

        if (!pendingHover.current) return;

        const { itemId: pendingItemId, element: pendingElement } =
          pendingHover.current;
        pendingHover.current = null;

        const item = clipboardItems.find((clip) => clip.id === pendingItemId);
        if (!item) return;

        setActiveId(item.id);
        void emitTo(
          "preview",
          PREVIEW_HOVER_EVENT,
          createPreviewHoverPayload(item, pendingElement, placement.current),
        ).catch((error: unknown) => {
          console.warn("Preview hover emit failed", error);
        });
      });
    },
    [],
  );

  const hidePreview = useCallback(() => {
    pendingHover.current = null;
    setActiveId(null);

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    void emitTo("preview", PREVIEW_HIDE_EVENT).catch((error: unknown) => {
      console.warn("Preview hide emit failed", error);
    });
  }, []);

  const startHistoryDrag = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.buttons !== 1) return;

    void getCurrentWindow().startDragging().catch((error: unknown) => {
      console.warn("History window drag failed", error);
    });
  }, []);

  return (
    <main className="history-shell">
      <header
        className="history-header"
        data-tauri-drag-region
        onMouseDown={startHistoryDrag}
      >
        <div className="history-title-group" data-tauri-drag-region>
          <span className="window-kicker" data-tauri-drag-region>
            Clipboard
          </span>
          <h1 data-tauri-drag-region>History</h1>
        </div>
        <span className="history-count" data-tauri-drag-region>
          {visibleItems.length}
        </span>
      </header>

      <section className="history-controls">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search clipboard history"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search clips"
          />
        </label>

        <div className="filter-tabs" role="tablist" aria-label="Clipboard type">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              aria-selected={filter === option.value}
              className="filter-tab"
              role="tab"
              type="button"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="history-list" onMouseLeave={hidePreview}>
        {visibleItems.map((item) => (
          <HistoryItem
            active={activeId === item.id}
            item={item}
            key={item.id}
            onHover={scheduleHover}
          />
        ))}
      </section>
    </main>
  );
}

function toPreviewPlacement(layout: {
  direction: PreviewPlacement["direction"];
  width: number;
  height: number;
}): PreviewPlacement {
  return {
    direction: layout.direction,
    windowWidth: layout.width,
    windowHeight: layout.height,
  };
}
