"use client";

import { useEffect, useState } from "react";
import { parentAdminRequest } from "@/lib/parent/admin-client";

export function useParentResource<T>(path: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ path: string; revision: number; data?: T; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    parentAdminRequest<T>(path, { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setState({ path, revision, data }); },
      error => { if (!controller.signal.aborted) setState({ path, revision, error: error.message }); },
    );
    return () => controller.abort();
  }, [path, revision]);
  const current = state?.path === path && state.revision === revision ? state : undefined;
  return { data: current?.data, error: current?.error, loading: !current, reload: () => setRevision(value => value + 1) };
}
