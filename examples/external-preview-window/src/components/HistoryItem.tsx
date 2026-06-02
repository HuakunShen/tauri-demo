import type { CSSProperties } from "react";
import type { ClipboardItem } from "../lib/clipboard-mock";

type HistoryItemProps = {
  active: boolean;
  item: ClipboardItem;
  onHover: (itemId: string, element: HTMLElement) => void;
};

export function HistoryItem({ active, item, onHover }: HistoryItemProps) {
  return (
    <article
      className="history-item"
      data-active={active}
      onMouseEnter={(event) => onHover(item.id, event.currentTarget)}
      onMouseMove={(event) => onHover(item.id, event.currentTarget)}
      style={{ "--item-accent": item.accent } as CSSProperties}
    >
      <div className="history-item-icon" aria-hidden="true">
        {item.type === "image" ? (
          <img src={item.thumbnailUrl} alt="" />
        ) : (
          <span>{item.title.slice(0, 1)}</span>
        )}
      </div>

      <div className="history-item-copy">
        <div className="history-item-top">
          <span className="history-item-type">{item.title}</span>
          <time>{item.createdAt}</time>
        </div>
        <p>{item.subtitle ?? item.previewText}</p>
      </div>
    </article>
  );
}
