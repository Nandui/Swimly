"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { ApiError, api, session } from "@/lib/api";
import type { Meta } from "@/lib/meta";

export function Tag({ meta }: { meta: Meta }) {
  const Icon = meta.icon;
  return <span className={`tag tone-${meta.tone}`}><Icon aria-hidden="true" />{meta.label}</span>;
}

const NOTICE_ICON = { info: Info, warning: TriangleAlert, error: CircleAlert };

/** A callout with an icon per tone, so colour is never the only signal. `live` announces it
 *  (alert for an error, status otherwise): only for the result of something the person just did,
 *  never for what a page says on load. */
export function Notice({ title, children, tone, live }: { title: string; children?: ReactNode; tone?: "error" | "warning"; live?: boolean }) {
  const Icon = NOTICE_ICON[tone ?? "info"];
  return (
    <div className={`notice${tone ? ` ${tone}` : ""}`} role={live ? (tone === "error" ? "alert" : "status") : undefined}>
      <Icon aria-hidden="true" />
      <div className="notice-body"><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>
    </div>
  );
}

/** An empty list: one muted row in the panel, where the rows would be. */
export function EmptyRows({ children }: { children: ReactNode }) {
  return <ul className="pc-rows"><li className="pc-row" data-muted>{children}</li></ul>;
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
      const failure = caught instanceof ApiError ? caught : new ApiError(0, "ERROR", "Could not complete that. Try again.");
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

/** Placeholder rows the shape of the list that is coming (Work's PageLoading). */
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="pc-panel" role="status">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="placeholder-row" />)}
    </div>
  );
}

export function LoadError({ error, retry }: { error: ApiError; retry: () => void }) {
  return (
    <div className="stack-sm">
      <Notice title="Couldn't load this" tone="error" live>{error.message}</Notice>
      <div><button type="button" className="button outline" onClick={retry}>Try again</button></div>
    </div>
  );
}
