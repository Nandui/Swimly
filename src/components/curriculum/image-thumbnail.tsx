"use client";

import { Thumbnail } from "@/components/workspace/misc";

export function ImageThumbnail({ src, name }: { src: string; name: string }) {
  return <Thumbnail src={src} alt={`${name} image`} label={`${name} image`} />;
}
