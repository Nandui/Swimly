"use client";
import * as React from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
type Kind = "success" | "error";
type Notice = { id: number; kind: Kind; message: string };
let serial = 0;
let notices: Notice[] = [];
const listeners = new Set<() => void>();
const empty: Notice[] = [];
function update() { for (const listener of listeners) listener(); }
function dismiss(id: number) { notices = notices.filter(item => item.id !== id); update(); }
function emit(kind: Kind, message: string) { const id = ++serial; notices = [...notices, { id, kind, message }]; update(); if (kind === "success") setTimeout(() => dismiss(id), 5000); }
export const toast = { success: (message: string) => emit("success", message), error: (message: string) => emit("error", message) };
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function ToastBridge() {
  const items = React.useSyncExternalStore(subscribe, () => notices, () => empty);
  return <div role="region" className="workspace-toasts" aria-label="Notifications">{items.map(item => <div key={item.id} role={item.kind === "error" ? "alert" : "status"} className={`workspace-toast ${item.kind}`}><span aria-hidden="true">{item.kind === "error" ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}</span><p>{item.message}</p><button type="button" aria-label="Dismiss notification" onClick={() => dismiss(item.id)}><X size={18} /></button></div>)}</div>;
}
