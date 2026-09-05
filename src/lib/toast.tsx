"use client";

import * as React from "react";
import { useToast } from "@astryxdesign/core/Toast";

/** The app's one way to say "that worked" or "that didn't" from anywhere.
 *
 *  Astryx hands out toasts through a hook, which is right for a component and
 *  useless for the tail of a transition that has just awaited a server
 *  action. So this keeps the small imperative surface every call site already
 *  uses — `toast.success(...)`, `toast.error(...)` — and one component mounted
 *  under the theme, <ToastBridge>, carries each call to the hook. A call made
 *  before the bridge mounts waits in a short queue rather than being lost.
 *
 *  Success toasts go by themselves after a few seconds. Errors stay until
 *  dismissed, which is Astryx's default and the right one: a failure that
 *  disappears while somebody is looking at the pool is a failure nobody saw. */

type Kind = "success" | "error";
type Listener = (kind: Kind, message: string) => void;

let listener: Listener | null = null;
const queue: Array<[Kind, string]> = [];

function emit(kind: Kind, message: string) {
  if (listener) listener(kind, message);
  else queue.push([kind, message]);
}

export const toast = {
  success(message: string) {
    emit("success", message);
  },
  error(message: string) {
    emit("error", message);
  },
};

export function ToastBridge() {
  const show = useToast();

  React.useEffect(() => {
    listener = (kind, message) => {
      show({ body: message, type: kind === "error" ? "error" : "info" });
    };
    for (const [kind, message] of queue.splice(0)) listener(kind, message);
    return () => {
      listener = null;
    };
  }, [show]);

  return null;
}
