import * as React from "react";
import NextLink from "next/link";
import { cn } from "@/lib/utils";
export function Text({
  as: Tag = "span",
  color = "primary",
  type,
  weight,
  display,
  hasTabularNumbers,
  maxLines,
  textWrap,
  justify,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  color?: "primary" | "secondary";
  type?: "supporting" | "large" | "inherit";
  weight?: "normal" | "medium" | "semibold";
  display?: "block";
  hasTabularNumbers?: boolean;
  maxLines?: number;
  hasTruncateTooltip?: boolean;
  textWrap?: "nowrap";
  justify?: "center";
}) {
  return (
    <Tag
      {...props}
      className={cn(
        color === "secondary" && "text-muted-foreground",
        type === "supporting" && "text-[13px]",
        type === "large" && "text-base",
        type === "inherit" && "text-inherit",
        weight === "medium" && "font-medium",
        weight === "semibold" && "font-semibold",
        weight === "normal" && "font-normal",
        display === "block" && "block",
        hasTabularNumbers && "tabular-nums",
        maxLines === 1 && "truncate",
        textWrap === "nowrap" && "whitespace-nowrap",
        justify === "center" && "text-center",
        className,
      )}
    />
  );
}
export function Heading({
  level = 2,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  const Tag = `h${level}` as "h1";
  return (
    <Tag
      {...props}
      className={cn(
        "font-semibold tracking-tight",
        level === 1
          ? "text-[28px] sm:text-[32px] leading-tight"
          : level === 2
            ? "text-xl"
            : level === 3
              ? "text-base"
              : "text-sm",
        className,
      )}
    />
  );
}
export function Link({
  color,
  weight,
  hasUnderline,
  display,
  size,
  className,
  ...props
}: React.ComponentProps<typeof NextLink> & {
  color?: "primary" | "secondary";
  weight?: "medium";
  hasUnderline?: boolean;
  isStandalone?: boolean;
  display?: "block";
  size?: "sm";
}) {
  return (
    <NextLink
      {...props}
      className={cn(
        "workspace-link",
        color === "secondary" ? "text-muted-foreground" : "text-primary",
        weight === "medium" && "font-medium",
        hasUnderline && "underline",
        display === "block" && "block",
        size === "sm" && "text-sm",
        className,
      )}
    />
  );
}
export function Breadcrumbs({
  children,
}: {
  children: React.ReactNode;
  variant?: "supporting";
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        {children}
      </ol>
    </nav>
  );
}
export function BreadcrumbItem({
  children,
  href,
  isCurrent,
}: {
  children: React.ReactNode;
  href?: string;
  isCurrent?: boolean;
}) {
  return (
    <li className="inline-flex items-center gap-2">
      {href ? (
        <NextLink href={href} className="inline-flex items-center min-h-11">
          {children}
        </NextLink>
      ) : (
        <span aria-current={isCurrent ? "page" : undefined}>{children}</span>
      )}
      {!isCurrent && <span aria-hidden="true">/</span>}
    </li>
  );
}
