"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type InvalidEvent } from "react";
import type { ActionResult } from "@/lib/action-result";

type FieldErrors = Record<string, string>;
const FieldFeedbackContext = createContext<{ errors: FieldErrors; clear: (name: string) => void }>({ errors: {}, clear: () => {} });

/** Shared server-error placement; native constraint validation stays native. */
export function useFormFeedback() {
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failureVersion, setFailureVersion] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!message) return;
    const frame = requestAnimationFrame(() => {
      const field = Array.from(formRef.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? [])
        .find(element => element.getClientRects().length > 0 && !element.matches(":disabled"));
      const target = field ?? summaryRef.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [message, failureVersion]);
  return {
    message, errors, formRef, summaryRef,
    report(failure: string | Extract<ActionResult, { ok: false }>) {
      setMessage(typeof failure === "string" ? failure : failure.error);
      setErrors(typeof failure === "string" ? {} : failure.fieldErrors ?? {});
      setFailureVersion(version => version + 1);
    },
    reset() { setMessage(""); setErrors({}); },
    clear(name: string) {
      if (!errors[name]) return;
      const next = { ...errors }; delete next[name];
      setErrors(next);
      if (!Object.keys(next).length) setMessage("");
    },
  };
}

export function FormFeedbackProvider({ feedback, children }: { feedback: Pick<ReturnType<typeof useFormFeedback>, "errors" | "clear">; children: ReactNode }) {
  return <FieldFeedbackContext value={{ errors: feedback.errors, clear: feedback.clear }}>{children}</FieldFeedbackContext>;
}

export function useFieldFeedback(name?: string) {
  const context = useContext(FieldFeedbackContext);
  const [nativeError, setNativeError] = useState("");
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const form = fieldRef.current?.form;
    const reset = () => setNativeError("");
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [nativeError]);
  return {
    error: (name && context.errors[name]) || nativeError || undefined,
    clear() { setNativeError(""); if (name) context.clear(name); },
    onInvalid(event: InvalidEvent<HTMLInputElement | HTMLTextAreaElement>) {
      if (event.defaultPrevented) return;
      const field = event.currentTarget;
      fieldRef.current = field;
      const label = (field.labels?.[0]?.textContent || field.getAttribute("aria-label") || "this field")
        .replace(/\(required\)/g, "").trim().toLowerCase();
      setNativeError(field.validity.valueMissing ? `Enter ${label}.`
        : field.validity.typeMismatch && field instanceof HTMLInputElement && field.type === "email" ? "Enter a valid email address."
        : field.validationMessage);
    },
  };
}
