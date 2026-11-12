/** Sends one photo to a request (/api/maintenance/photos), from the report form and the request's
 *  page. The server checks it, shrinks it and says in one sentence when it is refused. */
export async function uploadPhoto(requestId: string, file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = new FormData();
  body.set("requestId", requestId);
  body.set("file", file);
  try {
    const response = await fetch("/api/maintenance/photos", { method: "POST", body });
    const result = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? "Could not add the photo. Try again." };
  } catch {
    return { ok: false, error: "Could not add the photo. Check the connection and try again." };
  }
}
