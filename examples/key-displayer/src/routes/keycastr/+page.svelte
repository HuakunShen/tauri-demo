<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";

  interface KeycastrEvent {
    type: string;
    key?: string;
    keys?: string[];
    button?: number;
    x?: number;
    y?: number;
    timestamp: number;
  }

  interface QueuedKey {
    id: number;
    key: string;
    timestamp: number;
    fading: boolean;
  }

  const modifierKeys = ["Ctrl", "Alt", "Shift", "⌘"];
  const specialKeys = ["Esc", "Tab", "Caps", "Enter", "⌫", "Del", "Ins", "Home", "End", "PgUp", "PgDn"];
  const mouseButtons = ["MouseL", "MouseM", "MouseR"];

  let keyQueue = $state<QueuedKey[]>([]);
  let mousePos = $state({ x: 0, y: 0 });
  let unlisten: UnlistenFn | undefined;
  let fadeInterval: ReturnType<typeof setInterval> | null = null;
  let keyIdCounter = 0;

  const MAX_QUEUE_SIZE = 8;
  const KEY_LIFETIME_MS = 2000;
  const FADE_DURATION_MS = 500;

  function getKeyClass(key: string, fading: boolean): string {
    const baseClass = "key-badge";
    const fadeClass = fading ? "fading" : "active";
    
    if (mouseButtons.includes(key)) {
      return `${baseClass} ${fadeClass} mouse`;
    }
    if (modifierKeys.includes(key)) {
      return `${baseClass} ${fadeClass} modifier`;
    }
    if (specialKeys.includes(key)) {
      return `${baseClass} ${fadeClass} special`;
    }
    return `${baseClass} ${fadeClass} regular`;
  }

  function addToQueue(key: string) {
    const now = Date.now();
    keyIdCounter++;
    
    const newKey: QueuedKey = {
      id: keyIdCounter,
      key,
      timestamp: now,
      fading: false,
    };

    keyQueue = [...keyQueue, newKey];

    if (keyQueue.length > MAX_QUEUE_SIZE) {
      const oldest = keyQueue[0];
      if (oldest && !oldest.fading) {
        oldest.fading = true;
        keyQueue = [...keyQueue];
        
        setTimeout(() => {
          keyQueue = keyQueue.filter(k => k.id !== oldest.id);
        }, FADE_DURATION_MS);
      }
    }
  }

  function processExpiredKeys() {
    const now = Date.now();
    let hasChanges = false;
    
    for (const qk of keyQueue) {
      if (!qk.fading && now - qk.timestamp > KEY_LIFETIME_MS) {
        qk.fading = true;
        hasChanges = true;
        
        setTimeout(() => {
          keyQueue = keyQueue.filter(k => k.id !== qk.id);
        }, FADE_DURATION_MS);
      }
    }
    
    if (hasChanges) {
      keyQueue = [...keyQueue];
    }
  }

  async function closeWindow() {
    const window = getCurrentWindow();
    await window.hide();
  }

  onMount(async () => {
    console.log("Keycastr: Starting event listener...");
    unlisten = await listen<KeycastrEvent>("keycastr-event", (event: { payload: KeycastrEvent }) => {
      const data = event.payload;
      console.log("Keycastr: Received event:", data);
      
      if (data.type === "keydown" && data.key) {
        console.log("Keycastr: Adding key to queue:", data.key);
        addToQueue(data.key);
      } else if (data.type === "mousedown") {
        const buttonNames = ["MouseL", "MouseM", "MouseR"];
        const btn = data.button ? buttonNames[data.button - 1] || `Mouse${data.button}` : "Mouse";
        console.log("Keycastr: Adding mouse button to queue:", btn);
        addToQueue(btn);
      } else if (data.type === "mousemove" && data.x !== undefined && data.y !== undefined) {
        mousePos = { x: Math.round(data.x), y: Math.round(data.y) };
      }
    });

    fadeInterval = setInterval(processExpiredKeys, 100);
    console.log("Keycastr: Event listener started");
  });

  onDestroy(() => {
    unlisten?.();
    if (fadeInterval) clearInterval(fadeInterval);
  });
</script>

<div class="keycastr-container">
  <div class="drag-handle" data-tauri-drag-region>
    <div class="drag-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <button class="close-btn" onclick={closeWindow} title="Hide"></button>
  </div>

  <div class="keys-wrapper">
    {#if keyQueue.length === 0}
      <span class="waiting-text">Waiting for input...</span>
    {:else}
      {#each keyQueue as qk (qk.id)}
        <span class={getKeyClass(qk.key, qk.fading)}>
          {#if mouseButtons.includes(qk.key)}
            <span class="mouse-icon" data-btn={qk.key.slice(-1)}></span>
          {:else}
            {qk.key}
          {/if}
        </span>
      {/each}
    {/if}
  </div>
  
  <div class="mouse-pos">
    {mousePos.x}, {mousePos.y}
  </div>
</div>

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: transparent;
  }

  .keycastr-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 12px;
    overflow: hidden;
    user-select: none;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 2px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .drag-handle {
    width: 100%;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
    cursor: grab;
    app-region: drag;
    -webkit-app-region: drag;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .drag-handle button {
    app-region: no-drag;
    -webkit-app-region: no-drag;
  }

  .drag-dots {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .drag-dots span {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
  }

  .close-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 100, 100, 0.6);
  }

  .close-btn::before,
  .close-btn::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 1.5px;
    background: rgba(255, 255, 255, 0.6);
  }

  .close-btn::before {
    transform: rotate(45deg);
  }

  .close-btn::after {
    transform: rotate(-45deg);
  }

  .keys-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 16px 20px;
    max-width: 100%;
    flex: 1;
    overflow: hidden;
  }

  .waiting-text {
    color: rgba(255, 255, 255, 0.25);
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 500;
  }

  .key-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 38px;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.3),
      0 1px 2px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.12);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    position: relative;
    overflow: hidden;
  }

  .key-badge::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.15), transparent);
    border-radius: 8px 8px 0 0;
    pointer-events: none;
  }

  .key-badge.active {
    opacity: 1;
    transform: scale(1);
    animation: keyPress 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .key-badge.fading {
    opacity: 0;
    transform: scale(0.85) translateY(4px);
  }

  .key-badge.regular {
    background: linear-gradient(145deg, #3a3a3c, #2c2c2e);
    color: #f5f5f7;
  }

  .key-badge.modifier {
    background: linear-gradient(145deg, #0a84ff, #0077ed);
    color: white;
  }

  .key-badge.special {
    background: linear-gradient(145deg, #bf5af2, #a855f7);
    color: white;
  }

  .key-badge.mouse {
    background: linear-gradient(145deg, #30d158, #28bd4a);
    color: white;
    padding: 0 10px;
    border-radius: 10px;
    font-size: 12px;
  }

  .mouse-icon {
    display: flex;
    align-items: center;
    gap: 3px;
    font-weight: 600;
  }

  .mouse-icon::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 14px;
    background: currentColor;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='6' y='3' width='12' height='18' rx='6'/%3E%3Cline x1='12' y1='7' x2='12' y2='11'/%3E%3C/svg%3E") no-repeat center;
    mask-size: contain;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='6' y='3' width='12' height='18' rx='6'/%3E%3Cline x1='12' y1='7' x2='12' y2='11'/%3E%3C/svg%3E") no-repeat center;
    -webkit-mask-size: contain;
    opacity: 0.9;
  }

  .mouse-icon::after {
    content: attr(data-btn);
    font-size: 10px;
    opacity: 0.9;
  }

  .mouse-icon[data-btn="L"]::after { content: 'L'; }
  .mouse-icon[data-btn="M"]::after { content: 'M'; }
  .mouse-icon[data-btn="R"]::after { content: 'R'; }

  .mouse-pos {
    position: absolute;
    bottom: 6px;
    right: 12px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
    font-weight: 500;
    letter-spacing: 0.5px;
  }

  @keyframes keyPress {
    0% {
      transform: scale(0.7);
      opacity: 0;
    }
    40% {
      transform: scale(1.15);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
