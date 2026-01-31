<script lang="ts">
  import { onMount } from "svelte"
  import { invoke } from "@tauri-apps/api/core"

  let inputValue = $state("")
  let inputRef: HTMLInputElement
  let selectedIndex = $state(0)
  let isPinned = $state(false)

  type Command = {
    id: string
    title: string
    subtitle: string
    icon: string
    isPinCommand?: boolean
  }

  // Sample command items - replace with your actual commands
  let commands = $state<Command[]>([
    { id: "1", title: "Search Files", subtitle: "Find files across your system", icon: "🔍" },
    { id: "2", title: "Open Settings", subtitle: "Configure application preferences", icon: "⚙️" },
    { id: "3", title: "Recent Documents", subtitle: "View recently opened files", icon: "📄" },
    { id: "4", title: "Clipboard History", subtitle: "Access copied items", icon: "📋" },
    { id: "5", title: "Calculator", subtitle: "Quick calculations", icon: "🧮" },
  ])

  // Add pin/unpin command at the top
  let allCommands = $derived([
    { 
      id: "pin", 
      title: isPinned ? "📌 Unpin Window" : "📌 Pin Window", 
      subtitle: isPinned ? "Allow window to close on blur" : "Keep window open on blur",
      icon: "📌",
      isPinCommand: true
    },
    ...commands
  ])

  let filteredCommands = $derived(
    inputValue.trim()
      ? allCommands.filter(
          (c) =>
            c.title.toLowerCase().includes(inputValue.toLowerCase()) ||
            c.subtitle.toLowerCase().includes(inputValue.toLowerCase())
        )
      : allCommands
  )

  onMount(() => {
    inputRef?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        invoke("hide_window")
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        selectedIndex = (selectedIndex + 1) % filteredCommands.length
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length
      }
      if (e.key === "Enter") {
        if (filteredCommands.length > 0) {
          handleSelect(filteredCommands[selectedIndex])
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  })

  function handleSelect(command: Command) {
    if (command.isPinCommand) {
      // Toggle pin state
      isPinned = !isPinned
      // Reset selection and refocus input
      selectedIndex = 0
      inputRef?.focus()
      return
    }
    
    console.log("Selected:", command)
    inputValue = ""
    selectedIndex = 0
    invoke("hide_window")
  }

  function handleBlur(e: FocusEvent) {
    // Don't hide if window is pinned
    if (isPinned) return
    
    // Only hide if the new focused element is outside the window
    const relatedTarget = e.relatedTarget as HTMLElement | null
    if (!relatedTarget || !document.contains(relatedTarget)) {
      invoke("hide_window")
    }
  }

  function clearInput() {
    inputValue = ""
    selectedIndex = 0
    inputRef?.focus()
  }
</script>

<main class="spotlight-container" data-tauri-drag-region>
  <div class="spotlight-wrapper">
    <!-- Input Section -->
    <div class="input-wrapper" data-tauri-drag-region>
      <svg class="search-icon" data-tauri-drag-region viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      <input
        bind:this={inputRef}
        bind:value={inputValue}
        type="text"
        placeholder="Search commands..."
        class="spotlight-input"
        onblur={handleBlur}
      />
      {#if isPinned}
        <span class="pin-indicator">📌</span>
      {/if}
      {#if inputValue}
        <button class="clear-btn" onclick={clearInput} aria-label="Clear input">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18"></path>
            <path d="m6 6 12 12"></path>
          </svg>
        </button>
      {/if}
    </div>

    <!-- Results List -->
    {#if filteredCommands.length > 0}
      <div class="results-list">
        {#each filteredCommands as command, index}
          <button
            class="result-item"
            class:selected={index === selectedIndex}
            class:pin-command={command.isPinCommand}
            onclick={() => handleSelect(command)}
            onmouseenter={() => (selectedIndex = index)}
          >
            <span class="result-icon">{command.icon}</span>
            <div class="result-text">
              <div class="result-title">{command.title}</div>
              <div class="result-subtitle">{command.subtitle}</div>
            </div>
          </button>
        {/each}
      </div>
    {:else if inputValue}
      <div class="no-results">No results found</div>
    {/if}
  </div>
</main>

<style>
  :global(*) {
    box-sizing: border-box
  }

  :global(html),
  :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
  }

  .spotlight-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    background: transparent;
    overflow: hidden
  }

  .spotlight-wrapper {
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
    display: flex;
    flex-direction: column
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0
  }

  .search-icon {
    width: 18px;
    height: 18px;
    color: rgba(255, 255, 255, 0.5);
    flex-shrink: 0;
    margin-right: 10px
  }

  .spotlight-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: white;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.4;
    min-width: 0
  }

  .spotlight-input::placeholder {
    color: rgba(255, 255, 255, 0.4)
  }

  .pin-indicator {
    font-size: 14px;
    margin-left: 8px;
    margin-right: 8px
  }

  .clear-btn {
    width: 18px;
    height: 18px;
    padding: 0;
    margin: 0;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-left: 8px;
    transition: background 0.15s ease
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.2)
  }

  .clear-btn svg {
    width: 10px;
    height: 10px;
    color: rgba(255, 255, 255, 0.6)
  }

  .results-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px
  }

  .result-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease
  }

  .result-item:hover,
  .result-item.selected {
    background: rgba(255, 255, 255, 0.1)
  }

  .result-item.pin-command {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 4px;
    padding-bottom: 12px
  }

  .result-icon {
    font-size: 18px;
    margin-right: 12px;
    flex-shrink: 0
  }

  .result-text {
    flex: 1;
    min-width: 0
  }

  .result-title {
    color: white;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.3
  }

  .result-subtitle {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    line-height: 1.3;
    margin-top: 2px
  }

  .no-results {
    padding: 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px
  }

  @media (prefers-color-scheme: light) {
    .spotlight-wrapper {
      background: transparent
    }

    .input-wrapper {
      border-bottom-color: rgba(0, 0, 0, 0.1)
    }

    .search-icon {
      color: rgba(0, 0, 0, 0.4)
    }

    .spotlight-input {
      color: #1a1a1a
    }

    .spotlight-input::placeholder {
      color: rgba(0, 0, 0, 0.4)
    }

    .clear-btn {
      background: rgba(0, 0, 0, 0.1)
    }

    .clear-btn:hover {
      background: rgba(0, 0, 0, 0.15)
    }

    .clear-btn svg {
      color: rgba(0, 0, 0, 0.5)
    }

    .result-item:hover,
    .result-item.selected {
      background: rgba(0, 0, 0, 0.05)
    }

    .result-item.pin-command {
      border-bottom-color: rgba(0, 0, 0, 0.05)
    }

    .result-title {
      color: #1a1a1a
    }

    .result-subtitle {
      color: rgba(0, 0, 0, 0.5)
    }

    .no-results {
      color: rgba(0, 0, 0, 0.5)
    }
  }
</style>
