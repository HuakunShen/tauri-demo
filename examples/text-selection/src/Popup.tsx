import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./Popup.css";

function Popup() {
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const text = params.get("text");
    if (text) {
      setSelectedText(decodeURIComponent(text));
    }
  }, []);

  const handleTranslate = async () => {
    await invoke("translate_text", { text: selectedText });
    await closePopup();
  };

  const handleSummarize = async () => {
    await invoke("summarize_text", { text: selectedText });
    await closePopup();
  };

  const closePopup = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  return (
    <div className="popup-container">
      <div className="popup-buttons">
        <button
          className="popup-btn popup-btn-primary"
          onClick={handleTranslate}
        >
          Translate
        </button>
        <button
          className="popup-btn popup-btn-secondary"
          onClick={handleSummarize}
        >
          Summarize
        </button>
      </div>
      {selectedText && (
        <div className="popup-text">
          {selectedText.slice(0, 50)}
          {selectedText.length > 50 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

export default Popup;
