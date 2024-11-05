import { createSyncStore, type WithSyncStore } from "$lib/sync-store";

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
