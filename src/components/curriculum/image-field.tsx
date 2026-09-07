"use client";

import { useEffect, useRef, useState } from "react";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ImageThumbnail } from "./image-thumbnail";
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES } from "@/lib/curriculum/image";

export function ImageField({ currentSrc, name = "Programme or level" }: { currentSrc?: string; name?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [preview, setPreview] = useState<string | undefined>();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);
  function choose(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : undefined);
    setRemoved(false);
  }
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    // Astryx FileInput is controlled and has no htmlName. The native formdata
    // event also fires for FormDialog's new FormData(form), so the chosen file
    // stays in this form and is uploaded only when the person presses Save.
    const append = (event: FormDataEvent) => {
      if (file) event.formData.set("image", file);
      event.formData.set("removeImage", String(removed));
    };
    form.addEventListener("formdata", append);
    return () => form.removeEventListener("formdata", append);
  }, [file, removed]);
  const src = file ? preview : removed ? undefined : currentSrc;
  return (
    <div ref={root}>
      <VStack gap={2}>
        <FileInput label="Image" isOptional mode="dropzone" accept={IMAGE_ACCEPT} maxSize={IMAGE_MAX_BYTES}
          description="JPG, PNG or WebP, up to 2 MB. Saved with the programme or level."
          value={file} onChange={(value) => choose(Array.isArray(value) ? value[0] ?? null : value)} />
        {src ? <HStack gap={2} vAlign="center" wrap="wrap">
          <ImageThumbnail src={src} name={name} />
          <Button label="Remove image" variant="ghost" onClick={() => { choose(null); setRemoved(true); }} />
        </HStack> : null}
        {removed && currentSrc ? <HStack gap={2} vAlign="center" wrap="wrap">
          <Text color="secondary">The image will be removed when you save.</Text>
          <Button label="Keep current image" variant="ghost" onClick={() => setRemoved(false)} />
        </HStack> : null}
      </VStack>
    </div>
  );
}
