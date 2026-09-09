"use client";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./actions";
import { tones } from "./feedback";
export function Icon({
  icon,
  size = "md",
  color,
  label,
  className,
}: {
  icon: LucideIcon | "chevronRight";
  size?: "sm" | "md" | "lg";
  color?: string;
  label?: string;
  className?: string;
}) {
  const Component = typeof icon === "string" ? ChevronRight : icon;
  return (
    <Component
      size={size === "sm" ? 16 : size === "lg" ? 24 : 20}
      aria-hidden={!label}
      aria-label={label}
      className={cn(
        "shrink-0",
        color === "secondary" && "text-muted-foreground",
        className,
      )}
    />
  );
}
export function Token({
  label,
  color = "gray",
  size = "sm",
  href,
  onRemove,
  className,
}: {
  label: string;
  color?: keyof typeof tones;
  size?: "sm" | "lg";
  href?: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-lg text-xs font-medium",
        size === "lg" ? "min-h-11 px-3 text-sm" : "px-2.5 py-1",
        tones[color],
        className,
      )}
    >
      {href ? (
        <Link href={href} className="inline-flex min-h-11 items-center">
          {label}
        </Link>
      ) : (
        label
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <X size={16} />
        </button>
      ) : null}
    </span>
  );
}
export function Pagination({
  label,
  page,
  totalItems,
  pageSize,
  onChange,
}: {
  label: string;
  page: number;
  totalItems: number;
  pageSize: number;
  variant?: string;
  size?: string;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(totalItems / pageSize));
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground">
        {totalItems === 0
          ? "No results"
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalItems)} of ${totalItems}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          label="Previous page"
          icon={<ChevronLeft size={18} />}
          isIconOnly
          variant="secondary"
          isDisabled={page <= 1}
          onClick={() => onChange(page - 1)}
        />
        <span className="text-sm tabular-nums">
          {page} / {pages}
        </span>
        <Button
          label="Next page"
          icon={<ChevronRight size={18} />}
          isIconOnly
          variant="secondary"
          isDisabled={page >= pages}
          onClick={() => onChange(page + 1)}
        />
      </div>
    </nav>
  );
}
export function Thumbnail({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      title={label}
      width={80}
      height={80}
      unoptimized
      className="size-20 rounded-lg border object-cover"
    />
  );
}
