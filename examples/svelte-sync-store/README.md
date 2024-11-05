# Tauri Svelte Sync Store Across Windows with a Factory Function

> In this demo, I used Svelte because of its official standard store system that comes with the `svelte` package.
> You can always implement a similar factory function for other frontend frameworks and state management libraries like zustand, jotai, pinia, etc.

Svelte has a simple built-in store system.
Sometimes you need to sync the store across multiple windows.
For example, when app configuration in updated in settings window, you want to reflect the change in main window.

In Tauri, the event system let you communicate among windows using `emit` and `listen`.

The idea is very straight forward

1. Subscribe to the store change
2. Emit the change as an event
3. Listen to the change event in other windows and update the store
4. Make sure updating the store won't trigger `subscribe` callback and resulting in infinite loop
   - Svelte store itself don't have this problem, but you have to be very careful when you use other libraries
   - Always log in `subscribe` and `listen` callback while implementing a similar factory function to make sure there is no infinite loop

In this demo, I wrote a `createSyncStore` factory function that let you create a sync store.

It's in fact quit simple

```ts
import * as evt from "@tauri-apps/api/event";
import { writable, type Writable } from "svelte/store";

export function buildEventName(storeName: string) {
  return `app://sync-store-${storeName}`;
}

export type WithSyncStore<T> = Writable<T> & {
  listen: () => void;
  unlisten: evt.UnlistenFn | undefined;
};

export function createSyncStore<T>(
  storeName: string,
  initialValue: T
): WithSyncStore<T> {
  const store = writable<T>(initialValue);
  let unlisten: evt.UnlistenFn | undefined;

  async function listen() {
    console.log("[listen] start", storeName);
    if (unlisten) {
      console.log("[listen] already listening, skip");
      return;
    }
    const _unlisten = await evt.listen<{ value: T }>(
      buildEventName(storeName),
      (evt) => {
        console.log(
          `[listen] update from tauri event`,
          storeName,
          evt.payload.value
        );
        store.set(evt.payload.value);
      }
    );
    const unsubscribe = store.subscribe((value) => {
      console.log("[subscribe] got update, emit data", storeName, value);
      evt.emit(buildEventName(storeName), { value });
    });
    unlisten = () => {
      _unlisten();
      unsubscribe();
      unlisten = undefined;
    };
    return unlisten;
  }

  return {
    ...store,
    listen,
    unlisten,
  };
}
```

To construct a sync store with the factory function,

```ts
type CounterAPI = {
  increment: () => void;
  decrement: () => void;
};

export function createCounterStore(): WithSyncStore<number> & CounterAPI {
  const store = createSyncStore("counter", 0);
  return {
    ...store,
    increment: () => {
      store.update((value) => value + 1);
    },
    decrement: () => {
      store.update((value) => value - 1);
    },
  };
}

export const counterStore = createCounterStore();
```

In svelte components/pages, you can use the store like this

```ts
onMount(() => {
  counterStore.listen();
});

onDestroy(() => {
  counterStore.unlisten?.();
});
```

- `unlisten()` must be called on destroy to avoid multiple `listen` in the same window.
  - It stops the tauri event listener, and unsubscribe the store subscription
- `listen()` starts the tauri event listener, and subscribe the store
  - It checks if `unlisten` is already defined to avoid calling `listen` multiple times
