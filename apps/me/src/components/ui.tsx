"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, api, session } from "@/lib/api";
import type { Meta } from "@/lib/meta";

export function Tag({ meta }: { meta: Meta }) {
  const Icon = meta.icon;
  return <span className={`tag tone-${meta.tone}`}><Icon aria-hidden="true" />{meta.label}</span>;
}

export function Notice({ title, children, tone }: { title: string; children?: ReactNode; tone?: "error" | "warning" }) {
  return <div className={`notice${tone ? ` ${tone}` : ""}`} role={tone === "error" ? "alert" : "status"}><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>;
}

/** Loads one API resource for the page. Signed out → the sign-in page, and
 *  back here afterwards. */
export function useLoad<T>(path: string | null) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // Fetches without touching state; callers apply the outcome in a callback.
  const request = useCallback(async (): Promise<{ data: T } | { error: ApiError } | null> => {
    if (!path) return null;
    if (!session.token()) { router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`); return null; }
    try { return { data: await api<T>(path) }; }
    catch (caught) {
      const failure = caught instanceof ApiError ? caught : new ApiError(0, "ERROR", "Something went wrong. Please try again.");
      if (failure.status === 401) { router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`); return null; }
      return { error: failure };
    }
  }, [path, pathname, router]);
  const apply = useCallback((outcome: { data: T } | { error: ApiError } | null) => {
    if (!outcome) return;
    if ("data" in outcome) { setData(outcome.data); setError(null); } else setError(outcome.error);
  }, []);
  useEffect(() => {
    let live = true;
    request().then((outcome) => { if (live) apply(outcome); });
    return () => { live = false; };
  }, [request, apply]);
  const reload = useCallback(async () => apply(await request()), [request, apply]);
  return { data, setData, error, reload };
}

export function Loading() {
  return <p className="muted" role="status">Loading…</p>;
}

export function LoadError({ error, retry }: { error: ApiError; retry: () => void }) {
  return (
    <div className="stack-sm">
      <Notice title="Couldn't load this" tone="error">{error.message}</Notice>
      <div><button type="button" className="button outline" onClick={retry}>Try again</button></div>
    </div>
  );
}
