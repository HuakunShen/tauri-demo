import type { ClipboardItem } from "../lib/clipboard-mock";

type PreviewCardProps = {
  item: ClipboardItem | null;
};

export function PreviewCard({ item }: PreviewCardProps) {
  if (!item) {
    return <article className="preview-card" aria-hidden="true" />;
  }

  if (item.type === "image") {
    return (
      <article className="preview-card image-preview">
        <img src={item.imageUrl} alt={item.subtitle ?? item.title} />
        <div className="preview-meta">
          <span>{item.title}</span>
          <span>{item.subtitle}</span>
        </div>
      </article>
    );
  }

  if (item.type === "file") {
    return (
      <article className="preview-card file-preview">
        <div className="preview-meta">
          <span>{item.title}</span>
          <span>{item.createdAt}</span>
        </div>
        <pre>{item.previewText}</pre>
      </article>
    );
  }

  return (
    <article className="preview-card text-preview">
      <div className="preview-meta">
        <span>{item.title}</span>
        <span>{item.createdAt}</span>
      </div>
      <pre>{item.previewText}</pre>
    </article>
  );
}
