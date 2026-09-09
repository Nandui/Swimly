"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DemoStore } from "../lib/demo-store";
import type { SwimClass } from "../lib/types";
import type { StoragePort } from "../lib/persistence";

const Context = createContext<DemoStore | null>(null);
const subscribeMounted = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;

// The prototype's data source is browser storage, not a server. Render the
// same shell placeholder during SSR and hydration before constructing it.
export function PrototypeProvider({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeMounted,
    clientMounted,
    serverMounted,
  );
  return mounted ? (
    <StoreProvider>{children}</StoreProvider>
  ) : (
    <div className="loading-workspace" role="status">
      Opening your workspace…
    </div>
  );
}
function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => {
    const storage: StoragePort = {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
      removeItem: (key) => window.localStorage.removeItem(key),
    };
    return new DemoStore(storage);
  });
  useEffect(() => {
    store.start();
    const reconnect = () => {
      if (navigator.onLine) store.setNetwork("normal");
      else store.setNetwork("offline");
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    return () => {
      store.dispose();
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", reconnect);
    };
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useDemo() {
  const store = useContext(Context);
  if (!store) throw new Error("PrototypeProvider is missing");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return { store, state };
}
export function useLesson(course: SwimClass) {
  const { store } = useDemo();
  const controller = store.lesson(course);
  const lesson = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { controller, lesson };
}
