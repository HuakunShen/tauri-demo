export type ClipboardItemType = "text" | "image" | "file";

export type ClipboardItem = {
  id: string;
  type: ClipboardItemType;
  title: string;
  subtitle?: string;
  createdAt: string;
  previewText?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  accent: string;
};

export const clipboardItems: ClipboardItem[] = [
  {
    id: "clip-1",
    type: "text",
    title: "TEXT",
    subtitle: "现在不是有无缝吗？能不能这样...",
    createdAt: "00:51",
    previewText:
      "现在不是有无缝吗？能不能这样，位置线保证和上一个位置一样，不要来回的变换。Preview card 只在 webview 内部做 transform，原生窗口保持稳定。",
    accent: "#4f7cff",
  },
  {
    id: "clip-2",
    type: "image",
    title: "IMAGE",
    subtitle: "Screenshot 1133 x 711",
    createdAt: "06-02 23:48",
    thumbnailUrl: "/mock/screenshot-thumb.svg",
    imageUrl: "/mock/screenshot.svg",
    accent: "#14a878",
  },
  {
    id: "clip-3",
    type: "text",
    title: "TEXT",
    subtitle: "Tauri window capability notes",
    createdAt: "06-02 22:19",
    previewText:
      "The preview window should be transparent, non-focusable, skip the taskbar, and ignore cursor events. History owns hover detection; preview only renders.",
    accent: "#b66a24",
  },
  {
    id: "clip-4",
    type: "file",
    title: "FILE",
    subtitle: "external-preview-window/mvp-plan.md",
    createdAt: "06-02 20:08",
    previewText:
      "mvp-plan.md\n\nPhase 1: static dual windows\nPhase 2: click-through\nPhase 3: hover bridge\nPhase 4: coordinate clamp\nPhase 5: animation polish",
    accent: "#8a62d6",
  },
  {
    id: "clip-5",
    type: "text",
    title: "TEXT",
    subtitle: "Connector line alignment",
    createdAt: "06-01 18:43",
    previewText:
      "Connector Y follows the hovered item center, even when the card is clamped near the top or bottom of the preview window.",
    accent: "#d64f64",
  },
  {
    id: "clip-6",
    type: "image",
    title: "IMAGE",
    subtitle: "Mock product panel 1440 x 900",
    createdAt: "06-01 13:12",
    thumbnailUrl: "/mock/screenshot-thumb.svg",
    imageUrl: "/mock/screenshot.svg",
    accent: "#0d8aa6",
  },
];
