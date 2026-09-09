"use client";
import * as React from "react";
import NextLink from "next/link";
import { LoaderCircle } from "lucide-react";
import {
  Button as PrimitiveButton,
  buttonVariants,
} from "@/components/primitives/button";
import { cn } from "@/lib/utils";
const variants = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  destructive: "destructive",
} as const;
export type ButtonProps = Omit<
  React.ComponentProps<typeof PrimitiveButton>,
  "size" | "children" | "variant"
> & {
  label: React.ReactNode;
  children?: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  endContent?: React.ReactNode;
  variant?: keyof typeof variants;
  size?: "sm" | "md" | "lg";
  isDisabled?: boolean;
  isLoading?: boolean;
  isIconOnly?: boolean;
  width?: "100%";
  tooltip?: string;
  clickAction?: () => Promise<unknown>;
};
export function Button({
  label,
  children,
  href,
  icon,
  endContent,
  variant = "primary",
  size,
  isDisabled,
  isLoading,
  isIconOnly,
  width,
  tooltip,
  clickAction,
  className,
  onClick,
  disabled,
  ...props
}: Omit<ButtonProps, "variant"> & { variant?: keyof typeof variants }) {
  const [working, startTransition] = React.useTransition();
  const busy = isLoading || working;
  const content = (
    <>
      {busy ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        icon
      )}
      {isIconOnly ? null : (children ?? label)}
      {endContent}
    </>
  );
  const classes = cn(
    "app-button",
    isIconOnly && "size-11 p-2.5",
    width && "w-full",
    className,
  );
  if (href)
    return (
      <NextLink
        onClick={(event) => {
          if (isDisabled || disabled) event.preventDefault();
        }}
        tabIndex={isDisabled || disabled ? -1 : undefined}
        href={href}
        className={cn(buttonVariants({ variant: variants[variant] }), classes)}
        title={tooltip}
        aria-label={props["aria-label"] ?? (isIconOnly && typeof label === "string" ? label : undefined)}
        aria-disabled={isDisabled || disabled || undefined}
      >
        {content}
      </NextLink>
    );
  return (
    <PrimitiveButton
      {...props}
      type={props.type ?? "button"}
      size={isIconOnly ? 'icon' : size === 'lg' ? 'lg' : 'default'}
      variant={variants[variant]}
      disabled={isDisabled || disabled || busy}
      className={classes}
      title={tooltip}
      aria-label={
        isIconOnly && typeof label === "string" ? label : props["aria-label"]
      }
      aria-busy={busy || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && clickAction)
          startTransition(async () => {
            await clickAction();
          });
      }}
    >
      {content}
    </PrimitiveButton>
  );
}
export function IconButton(
  props: Omit<ButtonProps, "variant"> & { variant?: keyof typeof variants },
) {
  return <Button {...props} isIconOnly />;
}
export function ClickableCard({
  href,
  label,
  variant = "default",
  children,
}: {
  href: string;
  label: string;
  variant?: "blue" | "default";
  children: React.ReactNode;
  padding?: number;
  elevation?: "low" | "none";
}) {
  return (
    <NextLink
      href={href}
      aria-label={label}
      className={cn(
        "block rounded-xl border border-border p-6 shadow-xs",
        variant === "blue" ? "bg-brand-soft" : "bg-card",
        "hover:ring-2 hover:ring-ring/30",
      )}
    >
      {children}
    </NextLink>
  );
}
