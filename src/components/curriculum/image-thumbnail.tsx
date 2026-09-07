"use client";

import { Thumbnail } from "@astryxdesign/core/Thumbnail";

export function ImageThumbnail({ src, name }: { src: string; name: string }) {
  return <Thumbnail src={src} alt={`${name} image`} label={`${name} image`} />;
}
