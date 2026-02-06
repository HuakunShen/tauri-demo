<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWindow, getAllWindows } from "@tauri-apps/api/window";
  import { onMount } from "svelte";

  let isMonitoring = $state(false);
  let keycastrVisible = $state(true);

  async function getKeycastrWindow() {
    const windows = await getAllWindows();
    return windows.find(w => w.label === 'keycastr');
  }

  async function toggleMonitoring() {
    try {
      if (isMonitoring) {
        await invoke("stop_monitoring");
        isMonitoring = false;
      } else {
        await invoke("start_monitoring");
        isMonitoring = true;
      }
    } catch (e) {
      console.error("Failed to toggle monitoring:", e);
    }
  }

  async function toggleKeycastrWindow() {
    try {
      const keycastrWindow = await getKeycastrWindow();
      if (!keycastrWindow) {
        console.error("Keycastr window not found");
        return;
      }
      if (keycastrVisible) {
        await keycastrWindow.hide();
        keycastrVisible = false;
      } else {
        await keycastrWindow.show();
        keycastrVisible = true;
      }
    } catch (e) {
      console.error("Failed to toggle keycastr window:", e);
    }
  }

  onMount(async () => {
    try {
      isMonitoring = await invoke("is_monitoring");
      const keycastrWindow = await getKeycastrWindow();
      if (keycastrWindow) {
        keycastrVisible = await keycastrWindow.isVisible();
      }
    } catch (e) {
      console.error("Failed to get initial state:", e);
    }
  });
</script>

<main class="container">
  <h1>Key Displayer</h1>
  <p class="subtitle">A KeyCastr-like input monitoring app built with Tauri</p>

  <div class="controls">
    <button 
      class="btn-primary {isMonitoring ? 'active' : ''}" 
      onclick={toggleMonitoring}
    >
      {isMonitoring ? '⏹ Stop Monitoring' : '▶ Start Monitoring'}
    </button>

    <button 
      class="btn-secondary {keycastrVisible ? 'active' : ''}" 
      onclick={toggleKeycastrWindow}
    >
      {keycastrVisible ? '👁 Hide Overlay' : '👁 Show Overlay'}
    </button>
  </div>

  <div class="info">
    <h3>Instructions</h3>
    <ul>
      <li>Click <strong>Start Monitoring</strong> to begin capturing keyboard and mouse events</li>
      <li>Click <strong>Show Overlay</strong> to display the floating key display window</li>
      <li>The overlay shows your keystrokes and mouse clicks in real-time</li>
      <li>On macOS, you may need to grant Accessibility permissions</li>
    </ul>

    <div class="status">
      <div class="status-item">
        <span class="status-label">Monitoring:</span>
        <span class="status-value {isMonitoring ? 'on' : 'off'}">
          {isMonitoring ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">Overlay:</span>
        <span class="status-value {keycastrVisible ? 'on' : 'off'}">
          {keycastrVisible ? 'Visible' : 'Hidden'}
        </span>
      </div>
    </div>
  </div>
</main>

<style>
  :root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    font-weight: 400;
    color: #0f0f0f;
    background-color: #f6f6f6;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
  }

  .container {
    margin: 0;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    box-sizing: border-box;
  }

  h1 {
    font-size: 2.5em;
    font-weight: 700;
    margin: 0 0 8px 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: #666;
    margin: 0 0 40px 0;
    font-size: 1.1em;
  }

  .controls {
    display: flex;
    gap: 16px;
    margin-bottom: 40px;
    flex-wrap: wrap;
    justify-content: center;
  }

  button {
    padding: 14px 28px;
    border-radius: 12px;
    border: none;
    font-size: 1em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }

  button:active {
    transform: translateY(0);
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .btn-primary.active {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }

  .btn-secondary {
    background: white;
    color: #333;
    border: 2px solid #e0e0e0;
  }

  .btn-secondary.active {
    background: #f0f0f0;
    border-color: #667eea;
  }

  .info {
    background: white;
    padding: 30px;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    max-width: 500px;
    width: 100%;
  }

  .info h3 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.2em;
  }

  .info ul {
    margin: 0 0 24px 0;
    padding-left: 20px;
    color: #555;
  }

  .info li {
    margin-bottom: 8px;
  }

  .status {
    display: flex;
    gap: 24px;
    padding-top: 20px;
    border-top: 1px solid #eee;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-label {
    color: #888;
    font-size: 0.9em;
  }

  .status-value {
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.85em;
  }

  .status-value.on {
    background: #d4edda;
    color: #155724;
  }

  .status-value.off {
    background: #f8d7da;
    color: #721c24;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      color: #f6f6f6;
      background-color: #1a1a1a;
    }

    .subtitle {
      color: #aaa;
    }

    .info {
      background: #2a2a2a;
    }

    .info h3 {
      color: #f6f6f6;
    }

    .info ul {
      color: #ccc;
    }

    .btn-secondary {
      background: #2a2a2a;
      color: #f6f6f6;
      border-color: #444;
    }

    .btn-secondary.active {
      background: #333;
      border-color: #667eea;
    }

    .status {
      border-color: #444;
    }
  }
</style>
