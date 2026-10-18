/** Course file uploads, kept apart from the lesson editor so screens that only upload
 *  (the cover picker, the question bank, Start from a template) do not load the editor. */

export type UploadedFile = { id: string; name: string; mime: string; size: number };

/** Sends one file to the course and returns it. Errors are sentences for the author. */
export async function uploadCourseFile(courseId: string, file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.set("courseId", courseId);
  form.set("file", file);
  const response = await fetch("/training/files", { method: "POST", body: form }).catch(() => null);
  const data = await response?.json().catch(() => null);
  if (!response || !data?.ok) throw new Error(data?.error ?? "Could not add the file. Try again.");
  return data.file as UploadedFile;
}
