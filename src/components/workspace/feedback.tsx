import * as React from "react";
import { Badge as PrimitiveBadge } from "@/components/primitives/badge";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/primitives/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/primitives/empty";
import {
  Avatar as PrimitiveAvatar,
  AvatarFallback,
} from "@/components/primitives/avatar";
import { cn } from "@/lib/utils";
export const tones = {
  red: "bg-danger-soft text-danger-ink",
  error: "bg-danger-soft text-danger-ink",
  orange: "bg-warning-soft text-warning-ink",
  warning: "bg-warning-soft text-warning-ink",
  yellow: "bg-highlight text-highlight-foreground",
  green: "bg-success-soft text-success-ink",
  success: "bg-success-soft text-success-ink",
  blue: "bg-brand-soft text-brand-ink",
  info: "bg-brand-soft text-brand-ink",
  purple: "bg-category-purple text-category-purple-foreground",
  pink: "bg-category-pink text-category-pink-foreground",
  brown: "bg-highlight text-highlight-foreground",
  teal: "bg-success-soft text-success-ink",
  gray: "bg-muted text-muted-foreground",
  neutral: "bg-muted text-muted-foreground",
} as const;
export function Badge({
  label,
  variant = "neutral",
  className,
}: {
  label: React.ReactNode;
  variant?: keyof typeof tones;
  className?: string;
}) {
  return (
    <PrimitiveBadge
      variant="secondary"
      className={cn("app-badge", tones[variant], className)}
    >
      {label}
    </PrimitiveBadge>
  );
}
export function Banner({
  status,
  title,
  description,
  endContent,
  children,
}: {
  children?: React.ReactNode;
  status: "info" | "warning" | "error";
  title: React.ReactNode;
  description?: React.ReactNode;
  endContent?: React.ReactNode;
  collapsible?: false | { defaultIsOpen: boolean };
  container?: "section";
}) {
  return (
    <Alert
      role={status === "error" ? "alert" : "status"}
      className={cn("workspace-notice", tones[status])}
    >
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <AlertTitle>{title}</AlertTitle>
          {description && (
            <AlertDescription className="mt-1 text-inherit">
              {description}
            </AlertDescription>
          )}
        </div>
        {endContent}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </Alert>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  actions,
  isCompact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  isCompact?: boolean;
}) {
  return (
    <Empty className={isCompact ? "p-4" : "p-8"}>
      <EmptyHeader>
        {icon}
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {actions && <EmptyContent>{actions}</EmptyContent>}
    </Empty>
  );
}
export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tooltip?: boolean;
}) {
  return (
    <PrimitiveAvatar
      className={
        size === "lg" ? "size-14" : size === "sm" ? "size-8" : "size-10"
      }
      aria-hidden="true"
    >
      <AvatarFallback className="bg-brand-soft text-brand-ink font-semibold">
        {name
          .split(/\s+/)
          .slice(0, 2)
          .map((s) => s[0])
          .join("")}
      </AvatarFallback>
    </PrimitiveAvatar>
  );
}
export function StatusDot({
  variant,
  label,
}: {
  variant: "success" | "warning" | "error";
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-block size-2 rounded-full",
        variant === "success"
          ? "bg-success-ink"
          : variant === "warning"
            ? "bg-warning-ink"
            : "bg-danger-ink",
      )}
    />
  );
}
