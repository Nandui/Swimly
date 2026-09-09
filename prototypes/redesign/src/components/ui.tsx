"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { X, Check, AlertCircle, Info } from "lucide-react";
import { cn } from "../lib/utils";
import { Button as ShadcnButton, buttonVariants } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Avatar as ShadcnAvatar, AvatarFallback } from "./ui/avatar";
import { Alert, AlertDescription } from "./ui/alert";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "./ui/empty";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./ui/dialog";

export { Card } from "./ui/card";
export { NativeSelect } from "./ui/native-select";
export { Textarea } from "./ui/textarea";
export { Progress } from "./ui/progress";
export { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

const BUTTON_VARIANTS = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
} as const;
type ActionVariant = keyof typeof BUTTON_VARIANTS;

/** Domain-friendly names keep the screen code independent of the visual kit. */
export function Button({
  variant = "primary",
  className,
  ...props
}: Omit<ComponentProps<typeof ShadcnButton>, "variant"> & {
  variant?: ActionVariant;
}) {
  return (
    <ShadcnButton
      {...props}
      variant={BUTTON_VARIANTS[variant]}
      className={cn("app-button", className)}
    />
  );
}
export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ActionVariant }) {
  return (
    <Link
      {...props}
      className={cn(
        buttonVariants({ variant: BUTTON_VARIANTS[variant] }),
        "app-button",
        className,
      )}
    />
  );
}
export function TextInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return <Input {...props} className={cn("input", className)} />;
}

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  blue: "bg-brand-soft text-brand-ink",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
} as const;

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <Badge variant="secondary" className={cn("app-badge", TONES[tone])}>
      {children}
    </Badge>
  );
}
export function Avatar({
  initials,
  size = "normal",
}: {
  initials: string;
  size?: "small" | "normal" | "large";
}) {
  return (
    <ShadcnAvatar
      className={cn(
        "app-avatar",
        size === "large" ? "size-16" : size === "small" ? "size-8" : "size-10",
      )}
      aria-hidden="true"
    >
      <AvatarFallback
        className={cn(
          "bg-brand-soft text-brand-ink font-semibold",
          size === "large" && "text-xl",
        )}
      >
        {initials}
      </AvatarFallback>
    </ShadcnAvatar>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  const Icon =
    tone === "error" ? AlertCircle : tone === "success" ? Check : Info;
  return (
    <Alert
      variant={tone === "error" ? "destructive" : "default"}
      className="mb-4"
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Empty className="p-6">
      <EmptyHeader>
        <EmptyTitle role="heading" aria-level={3}>
          {title}
        </EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function SegmentTabs({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string; content: ReactNode }[];
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(String(next))}
      className="gap-0"
    >
      <TabsList className="workspace-tabs" aria-label={label}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent
          key={item.value}
          value={item.value}
          keepMounted
          className="tab-panel"
        >
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader className="pr-12">
          <DialogTitle className="text-xl leading-tight">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogClose
          render={
            <ShadcnButton
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3"
              disabled={busy}
            />
          }
          aria-label="Close dialog"
        >
          <X />
        </DialogClose>
        {children}
      </DialogContent>
    </Dialog>
  );
}
