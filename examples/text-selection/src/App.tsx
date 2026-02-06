import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./App.css";

interface TextSelectedEvent {
  text: string;
  x: number;
  y: number;
}

interface DebugEvent {
  message: string;
  timestamp: number;
}

function App() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [lastAction, setLastAction] = useState("");
  const [popupWindow, setPopupWindow] = useState<WebviewWindow | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugLogs]);

  useEffect(() => {
    invoke<boolean>("get_enabled_status").then((status) => {
      setIsEnabled(status);
    });

    const unlistenTextSelected = listen<TextSelectedEvent>("text-selected", (event) => {
      const { text, x, y } = event.payload;
      console.log("[FRONTEND] text-selected event received:", { text: text.substring(0, 20), x, y });
      setDebugLogs((prev) => [...prev.slice(-50), `[FRONTEND] Received text-selected: "${text.substring(0, 20)}..." at (${Math.round(x)}, ${Math.round(y)})`]);
      showPopup(text, x, y);
    });

    const unlistenTranslate = listen<string>("translate-request", (event) => {
      setLastAction(`Translate: ${event.payload}`);
    });

    const unlistenSummarize = listen<string>("summarize-request", (event) => {
      setLastAction(`Summarize: ${event.payload}`);
    });

    const unlistenDebug = listen<DebugEvent>("debug-event", (event) => {
      const time = new Date(event.payload.timestamp).toLocaleTimeString();
      setDebugLogs((prev) => [...prev.slice(-50), `[${time}] ${event.payload.message}`]);
    });

    return () => {
      unlistenTextSelected.then((fn) => fn());
      unlistenTranslate.then((fn) => fn());
      unlistenSummarize.then((fn) => fn());
      unlistenDebug.then((fn) => fn());
      if (popupWindow) {
        popupWindow.close();
      }
    };
  }, []);

  const showPopup = async (text: string, x: number, y: number) => {
    console.log("[FRONTEND] showPopup called with:", { text: text.substring(0, 20), x, y });
    setDebugLogs((prev) => [...prev.slice(-50), `[FRONTEND] showPopup called: "${text.substring(0, 15)}..." at (${Math.round(x)}, ${Math.round(y)})`]);
    
    if (!text || text.trim().length === 0) {
      console.log("[FRONTEND] Empty text, not showing popup");
      return;
    }

    // Close existing popup
    if (popupWindow) {
      console.log("[FRONTEND] Closing existing popup");
      try {
        await popupWindow.close();
      } catch (e) {
        console.log("[FRONTEND] Error closing existing popup:", e);
      }
      setPopupWindow(null);
    }

    // Calculate popup position (with boundary checks and negative coordinate handling)
    const popupWidth = 200;
    const popupHeight = 80;
    const offset = 10;
    
    // Ensure coordinates are not negative and add offset
    let popupX = Math.max(0, x) + offset;
    let popupY = Math.max(0, y) + offset;

    // Get screen dimensions
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;

    // Boundary checks
    if (popupX + popupWidth > screenWidth) {
      popupX = Math.max(0, x) - popupWidth - offset;
    }
    if (popupY + popupHeight > screenHeight) {
      popupY = Math.max(0, y) - popupHeight - offset;
    }
    
    // Final safety check - ensure window is on screen
    popupX = Math.max(0, Math.min(popupX, screenWidth - popupWidth));
    popupY = Math.max(0, Math.min(popupY, screenHeight - popupHeight));

    console.log("[FRONTEND] Creating popup at:", { popupX, popupY, screenWidth, screenHeight });
    setDebugLogs((prev) => [...prev.slice(-50), `[FRONTEND] Creating popup at (${Math.round(popupX)}, ${Math.round(popupY)}) screen: ${screenWidth}x${screenHeight}`]);

    // Create popup window with unique label
    const popupLabel = `popup-${Date.now()}`;
    try {
      const newPopup = new WebviewWindow(popupLabel, {
        url: `/popup.html?text=${encodeURIComponent(text)}`,
        title: "Text Selection",
        width: popupWidth,
        height: popupHeight,
        x: popupX,
        y: popupY,
        decorations: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        transparent: true,
        visible: true, // Make visible immediately
        focus: false,
      });

      newPopup.once("tauri://created", () => {
        console.log("[FRONTEND] Popup created successfully");
        setDebugLogs((prev) => [...prev.slice(-50), `[FRONTEND] Popup created successfully`]);
      });

      newPopup.once("tauri://error", (e) => {
        console.error("[FRONTEND] Failed to create popup:", e);
        setDebugLogs((prev) => [...prev.slice(-50), `[FRONTEND] ERROR creating popup: ${JSON.stringify(e)}`]);
      });

      // Close popup on blur
      newPopup.listen("tauri://blur", () => {
        console.log("[FRONTEND] Popup blur - closing");
        newPopup.close();
        setPopupWindow(null);
      });

      setPopupWindow(newPopup);
    } catch (e) {
      console.error("[FRONTEND] Exception creating popup:", e);
      setDebugLogs((prev) => [...prev.slice(-50), `[FRONTEND] EXCEPTION: ${e}`]);
    }
  };

  const toggleEnabled = async () => {
    const newStatus = await invoke<boolean>("toggle_enabled");
    setIsEnabled(newStatus);
  };

  return (
    <main className="container">
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold">Text Selection POC</h1>
        <p className="text-gray-600">
          Select text anywhere to see the popup
        </p>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${isEnabled ? "bg-green-500" : "bg-red-500"}`}
          />
          <span className="text-sm">{isEnabled ? "Active" : "Inactive"}</span>
        </div>

        <button
          onClick={toggleEnabled}
          className={`px-4 py-2 rounded ${
            isEnabled
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          {isEnabled ? "Disable" : "Enable"} Detection
        </button>
      </div>

      {lastAction && (
        <div className="max-w-md rounded-lg bg-gray-100 p-4">
          <p className="text-sm font-medium">Last Action:</p>
          <p className="mt-1 text-sm text-gray-600">{lastAction}</p>
        </div>
      )}

      <div className="max-w-md text-center text-sm text-gray-500">
        <p>Instructions:</p>
        <ul className="mt-2 list-inside list-disc text-left">
          <li>Select text by clicking and dragging</li>
          <li>A popup will appear near your selection</li>
          <li>Click Translate or Summarize to see the action</li>
        </ul>
      </div>

      {showDebug && (
        <div className="max-w-md w-full rounded-lg border border-gray-300 p-4 mt-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium">Debug Logs:</p>
            <button
              onClick={() => setDebugLogs([])}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Clear
            </button>
          </div>
          <div className="bg-black text-green-400 p-2 rounded text-xs font-mono h-48 overflow-y-auto">
            {debugLogs.length === 0 ? (
              <span className="text-gray-500">Waiting for events...</span>
            ) : (
              debugLogs.map((log, i) => (
                <div key={i} className="mb-1">
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      <button
        onClick={() => setShowDebug(!showDebug)}
        className="text-xs text-gray-400 hover:text-gray-600 mt-2"
      >
        {showDebug ? "Hide" : "Show"} Debug Logs
      </button>
    </main>
  );
}

export default App;
