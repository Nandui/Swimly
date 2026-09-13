"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Button } from "@/components/shadcn/button";
import { ImageThumbnail } from "./image-thumbnail";
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES } from "@/lib/curriculum/image";

/** Files post with the parent form; a preview never uploads a record. */
export function ImageField({
  currentSrc,
  name = "Programme or level",
}: {
  currentSrc?: string;
  name?: string;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [removed, setRemoved] = useState(false),
    [preview, setPreview] = useState<string>(),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => {
      setRemoved(false);
      setPreview(undefined);
      setError(null);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);
  const src = preview ?? (removed ? undefined : currentSrc);
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>Image</Label>
      <Input
        ref={input}
        id={id}
        name="image"
        type="file"
        accept={IMAGE_ACCEPT}
        aria-describedby={[`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(" ")}
        aria-invalid={!!error}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (
            file &&
            (file.size > IMAGE_MAX_BYTES ||
              !["image/jpeg", "image/png", "image/webp"].includes(file.type))
          ) {
            event.target.value = "";
            setPreview(undefined);
            setError("Choose a JPG, PNG or WebP image up to 2 MB.");
            return;
          }
          setError(null);
          setRemoved(false);
          setPreview(file ? URL.createObjectURL(file) : undefined);
        }}
      />
      <p id={`${id}-hint`} className="text-sm text-ui-muted-foreground">
        JPG, PNG or WebP, up to 2 MB. Saved with the programme or level.
      </p>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-ui-destructive">
          {error}
        </p>
      ) : null}
      <input type="hidden" name="removeImage" value={String(removed)} />
      {src ? (
        <div className="flex flex-wrap items-center gap-2">
          <ImageThumbnail src={src} name={name} />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (input.current) input.current.value = "";
              setPreview(undefined);
              setRemoved(true);
              setError(null);
            }}
          >
            Remove image
          </Button>
        </div>
      ) : null}
      {removed && currentSrc ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-ui-muted-foreground">
            The image will be removed when you save.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRemoved(false)}
          >
            Keep current image
          </Button>
        </div>
      ) : null}
    </div>
  );
}
