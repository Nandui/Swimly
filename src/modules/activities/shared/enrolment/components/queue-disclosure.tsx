"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Collapsible } from "@/components/shadcn/collapsible";

type Subscribe = (listener: () => void) => () => void;
const QueueOpened = createContext<Subscribe>(() => () => {});
export const useQueueOpened = () => useContext(QueueOpened);

export function QueueDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const listeners = useRef(new Set<() => void>());
  const subscribe = useCallback<Subscribe>(listener => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);
  return <QueueOpened.Provider value={subscribe}>
    <Collapsible open={open} onOpenChange={value => {
      setOpen(value);
      if (value) listeners.current.forEach(listener => listener());
    }} className="group/record w-full">{children}</Collapsible>
  </QueueOpened.Provider>;
}
