"use client";
import * as React from "react";
import NextLink from "next/link";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/primitives/toggle-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/primitives/tabs";
import { cn } from "@/lib/utils";
const ChoiceContext = React.createContext<{
  value: string[];
  change: (value: string[]) => void;
  name?: string;
  radio: boolean;
}>({ value: [], change: () => {}, radio: false });
export function CheckboxList({
  label,
  description,
  value,
  onChange,
  children,
  htmlName,
}: {
  label: string;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
  children: React.ReactNode;
  hasDividers?: boolean;
  width?: "100%";
  htmlName?: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-semibold mb-2">{label}</legend>
      {description && (
        <p className="text-muted-foreground text-sm mb-3">{description}</p>
      )}
      <ChoiceContext
        value={{ value, change: onChange, name: htmlName, radio: false }}
      >
        <div className="divide-y divide-border">{children}</div>
      </ChoiceContext>
    </fieldset>
  );
}
export function RadioList({
  label,
  value,
  onChange,
  htmlName,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  htmlName?: string;
  width?: "100%";
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="font-semibold mb-2">{label}</legend>
      <ChoiceContext
        value={{
          value: [value],
          change: (values) => onChange(values[0]),
          name: htmlName,
          radio: true,
        }}
      >
        {children}
      </ChoiceContext>
    </fieldset>
  );
}
export function CheckboxListItem({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description?: string;
}) {
  const c = React.use(ChoiceContext);
  return (
    <label className="workspace-choice-row">
      <input
        type={c.radio ? "radio" : "checkbox"}
        name={c.name}
        value={value}
        checked={c.value.includes(value)}
        onChange={(e) =>
          c.change(
            c.radio
              ? [value]
              : e.target.checked
                ? [...c.value, value]
                : c.value.filter((v) => v !== value),
          )
        }
        className="size-5 accent-primary"
      />
      <span>
        <span className="font-medium">{label}</span>
        {description && (
          <span className="block text-[13px] text-muted-foreground mt-1">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
export const RadioListItem = CheckboxListItem;
export function SegmentedControl({
  label,
  value,
  onChange,
  isDisabled,
  layout,
  size,
  className,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  layout?: "fill";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(values) => {
        if (values[0]) onChange(values[0]);
      }}
      disabled={isDisabled}
      spacing={1}
      className={cn(
        "segmented-buttons",
        layout === "fill" && "w-full",
        size === "lg" && "mark-controls",
        className,
      )}
      aria-label={label}
    >
      {children}
    </ToggleGroup>
  );
}
export function SegmentedControlItem({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return <ToggleGroupItem value={value}>{label}</ToggleGroupItem>;
}
const NavigationTabs = React.createContext("");
export function TabList({
  value,
  onChange,
  children,
  className,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  hasDivider?: boolean;
  overflow?: "scroll";
  size?: "lg";
  "aria-label"?: string;
}) {
  const items = React.Children.toArray(children);
  const links = items.some(
    (child) =>
      React.isValidElement<{ href?: string }>(child) && child.props.href,
  );
  return links ? (
    <NavigationTabs value={value}>
      <nav
        aria-label={props["aria-label"]}
        className={cn("workspace-nav-tabs", className)}
      >
        {children}
      </nav>
    </NavigationTabs>
  ) : (
    <Tabs value={value} onValueChange={(v) => onChange(String(v))}>
      <TabsList
        aria-label={props["aria-label"]}
        className={cn("workspace-inline-tabs", className)}
      >
        {children}
      </TabsList>
    </Tabs>
  );
}
export function Tab({
  value,
  label,
  href,
  endContent,
  ...props
}: {
  value: string;
  label: string;
  href?: string;
  endContent?: React.ReactNode;
  "aria-label"?: string;
}) {
  const active = React.use(NavigationTabs);
  return href ? (
    <NextLink
      {...props}
      href={href}
      aria-current={active === value ? "page" : undefined}
      className="workspace-nav-tab"
    >
      {label}
      {endContent}
    </NextLink>
  ) : (
    <TabsTrigger {...props} value={value}>
      {label}
      {endContent}
    </TabsTrigger>
  );
}
