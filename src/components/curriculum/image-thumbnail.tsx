"use client";

import Image from "next/image";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";

export function ImageThumbnail({ src, name }: { src: string; name: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="size-12 shrink-0 p-1"
          aria-label={`View ${name} image`}
        >
          <Image
            src={src}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="size-10 rounded-ui-sm object-contain"
          />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>Programme or level image</DialogDescription>
        </DialogHeader>
        <Image
          src={src}
          alt={`${name} image`}
          width={640}
          height={640}
          unoptimized
          className="max-h-[60dvh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
