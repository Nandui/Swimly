"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Progress } from "@/components/shadcn/progress";
import { Skeleton } from "@/components/shadcn/skeleton";
import { Notice as KitNotice } from "@/components/ui-kit/notice";
import { ApiError, api, session } from "@/lib/api";
import type { Meta } from "@/lib/meta";

/** A status: the meta supplies the words, tone and icon (Work's Tag). */
export function Tag({ meta }: { meta: Meta }) {
  const Icon = meta.icon;
  return <Badge data-tone={meta.tone}><Icon aria-hidden="true" />{meta.label}</Badge>;
}

/** A callout with an icon per tone (Work's Notice), so colour is never the only signal. `live`
 *  announces it (alert for an error, status otherwise): only for the result of something the
 *  person just did, never for what a page says on load. */
export function Notice({ title, children, tone, live, className }: { title: string; children?: ReactNode; tone?: "error" | "warning" | "success"; live?: boolean; className?: string }) {
  return <KitNotice title={title} tone={tone} live={live ? (tone === "error" ? "alert" : "status") : undefined} className={className}>{children}</KitNotice>;
}

/** How far through something is (lessons, questions, saving): the shadcn Progress bar. */
export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return <Progress value={max > 0 ? Math.round((Math.min(value, max) / max) * 100) : 0} aria-label={label} />;
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
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16 rounded-card" />)}
    </div>
  );
}

export function LoadError({ error, retry }: { error: ApiError; retry: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Notice title="Couldn't load this" tone="error" live>{error.message}</Notice>
      <div><Button type="button" variant="outline" onClick={retry}>Try again</Button></div>
    </div>
  );
}
