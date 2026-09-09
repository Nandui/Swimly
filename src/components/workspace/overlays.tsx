"use client";
import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { Collapsible as Fold } from "@base-ui/react/collapsible";
import { ChevronDown, X, type LucideIcon } from "lucide-react";
import {
  Dialog as Root,
  DialogContent,
  DialogHeader as Header,
  DialogTitle,
  DialogDescription,
} from "@/components/primitives/dialog";
import { Button, type ButtonProps } from "./actions";
import { cn } from "@/lib/utils";
export function Dialog({
  isOpen,
  onOpenChange,
  purpose,
  width = 448,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  purpose?: "form" | "required";
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <Root
      open={isOpen}
      onOpenChange={(next) => {
        if (purpose !== "required" || next) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="workspace-dialog"
        style={{ maxWidth: `min(calc(100% - 32px), ${width}px)` }}
      >
        {children}
      </DialogContent>
    </Root>
  );
}
export function DialogHeader({
  title,
  subtitle,
  onOpenChange,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Header className="pr-12 relative">
      <DialogTitle>{title}</DialogTitle>
      {subtitle ? (
        <DialogDescription>{subtitle}</DialogDescription>
      ) : (
        <DialogDescription className="sr-only">
          Review the details before confirming.
        </DialogDescription>
      )}
      <Button
        label="Close dialog"
        variant="ghost"
        isIconOnly
        icon={<X />}
        className="absolute -right-2 -top-2"
        isDisabled={!onOpenChange}
        onClick={() => onOpenChange?.(false)}
      />
    </Header>
  );
}
type MenuChoice = {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  endContent?: React.ReactNode;
  isDisabled?: boolean;
};
type MenuEntry =
  | MenuChoice
  | { type: "section"; title: string; items: MenuChoice[] }
  | { type: "divider" };
export function DropdownMenu({
  button,
  items,
  hasChevron = true,
  placement = "below",
  alignment = "start",
  menuWidth = 256,
}: {
  button: Omit<ButtonProps, "variant"> & {
    variant?: "primary" | "secondary" | "ghost";
  };
  items: MenuEntry[];
  hasChevron?: boolean;
  placement?: "below" | "above";
  alignment?: "start" | "end";
  menuWidth?: number;
}) {
  const row = (item: MenuChoice) => (
    <Menu.Item
      key={item.id}
      disabled={item.isDisabled}
      onClick={item.onClick}
      className="workspace-menu-item"
    >
      {item.icon && <item.icon className="size-4" />}
      <span className="min-w-0 flex-1">
        <span>{item.label}</span>
        {item.description && (
          <span className="block text-xs text-muted-foreground">
            {item.description}
          </span>
        )}
      </span>
      {item.endContent}
    </Menu.Item>
  );
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button
            {...button}
            endContent={
              hasChevron ? (
                <ChevronDown className="size-4" />
              ) : (
                button.endContent
              )
            }
          />
        }
      />
      <Menu.Portal>
        <Menu.Positioner
          side={placement === "above" ? "top" : "bottom"}
          align={alignment}
          sideOffset={8}
          className="z-60"
        >
          <Menu.Popup
            className="workspace-menu"
            style={{ width: menuWidth, maxWidth: "calc(100vw - 32px)" }}
          >
            {items.map((item, index) =>
              "type" in item ? (
                item.type === "divider" ? (
                  <Menu.Separator
                    key={index}
                    className="my-1 border-t border-border"
                  />
                ) : (
                  <Menu.Group key={index}>
                    <Menu.GroupLabel className="px-3 py-2 text-xs text-muted-foreground">
                      {item.title}
                    </Menu.GroupLabel>
                    {item.items.map(row)}
                  </Menu.Group>
                )
              ) : (
                row(item)
              ),
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
export function Collapsible({
  defaultIsOpen = false,
  trigger,
  children,
}: {
  defaultIsOpen?: boolean;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Fold.Root defaultOpen={defaultIsOpen}>
      <Fold.Trigger className="workspace-fold-trigger">
        {trigger}
        <ChevronDown
          aria-hidden="true"
          className="size-4 ml-auto transition-transform in-data-[panel-open]:rotate-180"
        />
      </Fold.Trigger>
      <Fold.Panel keepMounted className={cn("data-closed:hidden")}>
        {children}
      </Fold.Panel>
    </Fold.Root>
  );
}
