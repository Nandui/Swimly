import * as React from "react";
import NextLink from "next/link";
import { cn } from "@/lib/utils";
import { Card as Surface } from "@/components/primitives/card";

type BoxProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  gap?: number;
  width?: React.CSSProperties["width"];
  height?: React.CSSProperties["height"];
  minHeight?: React.CSSProperties["minHeight"];
  maxWidth?: React.CSSProperties["maxWidth"];
  padding?: number;
  paddingBlock?: number;
  paddingInline?: number;
  paddingBlockStart?: number;
  wrap?: "wrap" | "nowrap";
  hAlign?: "start" | "center" | "end" | "between";
  vAlign?: "start" | "center" | "end" | "stretch";
};
const alignment = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  stretch: "stretch",
};
const space = (n: number | undefined) =>
  n === undefined ? undefined : `calc(var(--spacing) * ${n})`;
function boxStyle({
  gap,
  width,
  height,
  minHeight,
  maxWidth,
  padding,
  paddingBlock,
  paddingInline,
  paddingBlockStart,
  wrap,
  hAlign,
  vAlign,
  style,
}: BoxProps): React.CSSProperties {
  return {
    gap: space(gap),
    width,
    height,
    minHeight,
    maxWidth,
    padding: space(padding),
    paddingBlock: space(paddingBlock),
    paddingInline: space(paddingInline),
    paddingBlockStart: space(paddingBlockStart),
    flexWrap: wrap,
    justifyContent: hAlign && alignment[hAlign],
    alignItems: vAlign && alignment[vAlign],
    ...style,
  };
}
function Stack({
  as: Tag = "div",
  gap = 4,
  width,
  height,
  minHeight,
  maxWidth,
  padding,
  paddingBlock,
  paddingInline,
  paddingBlockStart,
  wrap,
  hAlign,
  vAlign,
  style,
  className,
  direction,
  ...rest
}: BoxProps & { direction: "row" | "column" }) {
  return (
    <Tag
      {...rest}
      className={cn("min-w-0", className)}
      style={{
        display: "flex",
        flexDirection: direction,
        ...boxStyle({
          gap,
          width,
          height,
          minHeight,
          maxWidth,
          padding,
          paddingBlock,
          paddingInline,
          paddingBlockStart,
          wrap,
          hAlign,
          vAlign,
          style,
        }),
      }}
    />
  );
}
export function VStack(props: BoxProps) {
  return <Stack {...props} direction="column" />;
}
export function HStack(props: BoxProps) {
  return <Stack gap={2} {...props} direction="row" />;
}
export function StackItem({
  size,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { size?: "fill" }) {
  return (
    <div
      {...props}
      className={cn("min-w-0", size === "fill" && "flex-1", className)}
    />
  );
}
export function Center({
  axis = "both",
  children,
  ...props
}: BoxProps & { axis?: "both" | "horizontal" }) {
  return (
    <Stack
      {...props}
      direction="column"
      hAlign={axis === "both" ? "center" : undefined}
      vAlign="center"
    >
      {children}
    </Stack>
  );
}
export function Grid({
  columns,
  gap = 4,
  align,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  columns: { minWidth: number; max: number };
  gap?: number;
  align?: "stretch" | "start";
}) {
  return (
    <div
      {...props}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${columns.minWidth}px),1fr))`,
        gap: space(gap),
        alignItems: align,
        ...style,
      }}
    />
  );
}
export function Card({
  padding = 6,
  elevation,
  width,
  height,
  maxWidth,
  style,
  className,
  ...rest
}: React.ComponentProps<typeof Surface> & {
  padding?: number;
  elevation?: "low" | "none";
  width?: React.CSSProperties["width"];
  height?: React.CSSProperties["height"];
  maxWidth?: React.CSSProperties["maxWidth"];
}) {
  return (
    <Surface
      {...rest}
      className={cn("workspace-card gap-0", elevation === "none" && "shadow-none", className)}
      style={{ padding: space(padding), width, height, maxWidth, ...style }}
    />
  );
}
export function Section({
  padding = 4,
  paddingBlock,
  dividers = [],
  variant,
  children,
  className,
  ...props
}: BoxProps & { dividers?: ("top" | "bottom")[]; variant?: "muted" }) {
  return (
    <VStack
      {...props}
      padding={padding}
      paddingBlock={paddingBlock}
      className={cn(
        "workspace-section",
        dividers.includes("top") && "border-t",
        dividers.includes("bottom") && "border-b",
        variant === "muted" && "bg-muted rounded-lg",
        className,
      )}
    >
      {children}
    </VStack>
  );
}
export function Divider() {
  return <hr className="border-border" />;
}
export function FormLayout({
  direction = "vertical",
  children,
}: {
  direction?: "vertical" | "horizontal";
  defaultOptionality?: "optional" | "required";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "workspace-form-layout",
        direction === "horizontal" && "workspace-form-row",
      )}
    >
      {children}
    </div>
  );
}
export function List({
  children,
  hasDividers,
  density = "balanced",
  listStyle = "none",
  header,
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement> & {
  hasDividers?: boolean;
  density?: "compact" | "balanced" | "spacious";
  listStyle?: "none" | "disc";
  header?: React.ReactNode;
}) {
  return (
    <>
      {header && <div className="mb-3">{header}</div>}
      <ul
        {...props}
        className={cn(
          "workspace-list",
          hasDividers && "divide-y divide-border",
          listStyle === "disc" && "list-disc pl-5",
          className,
        )}
        data-density={density}
      >
        {children}
      </ul>
    </>
  );
}
type ItemProps = Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  as?: "li" | "div";
  label: React.ReactNode;
  description?: React.ReactNode;
  endContent?: React.ReactNode;
  startContent?: React.ReactNode;
  marker?: React.ReactNode;
  align?: "start" | "center";
  density?: "compact";
  href?: string;
  isDisabled?: boolean;
  isSelected?: boolean;
};
export function Item({
  as: Tag = "div",
  label,
  description,
  endContent,
  startContent,
  marker,
  align = "center",
  density,
  href,
  isDisabled,
  isSelected,
  className,
  onClick,
  ...props
}: ItemProps) {
  const body = (
    <>
      {startContent ?? marker}
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        {description && (
          <div className="mt-1 text-muted-foreground text-sm">
            {description}
          </div>
        )}
      </div>
      {endContent && <div className="workspace-row-actions">{endContent}</div>}
    </>
  );
  const classes = cn(
    "workspace-row",
    align === "start" && "items-start",
    isSelected && "bg-brand-soft",
    isDisabled && "opacity-60",
    className,
  );
  return (
    <Tag {...props} data-density={density} className={href || onClick ? "min-w-0" : classes}>
      {href ? (
        <NextLink
          href={href}
          className={classes}
          aria-label={props["aria-label"]}
        >
          {body}
        </NextLink>
      ) : onClick ? (
        <button
          type="button"
          className={cn(classes, "w-full text-left")}
          onClick={onClick}
          disabled={isDisabled}
        >
          {body}
        </button>
      ) : (
        body
      )}
    </Tag>
  );
}
export function ListItem(props: ItemProps) {
  return <Item as="li" {...props} />;
}
export function Table({
  hasHover = true,
  textOverflow,
  className,
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
  hasHover?: boolean;
  textOverflow?: "wrap";
}) {
  return (
    <div className="workspace-table-wrap">
      <table
        {...props}
        className={cn("workspace-table", hasHover && "has-hover", textOverflow === "wrap" && "whitespace-normal", className)}
      >
        {children}
      </table>
    </div>
  );
}
export function TableHeader(
  props: React.HTMLAttributes<HTMLTableSectionElement>,
) {
  return <thead {...props} />;
}
export function TableBody(
  props: React.HTMLAttributes<HTMLTableSectionElement>,
) {
  return <tbody {...props} />;
}
export function TableRow({
  isHeaderRow,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { isHeaderRow?: boolean }) {
  return <tr {...props} data-header-row={isHeaderRow || undefined} />;
}
export function TableCell(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />;
}
export function TableHeaderCell(
  props: React.ThHTMLAttributes<HTMLTableCellElement>,
) {
  return <th {...props} />;
}
export function MetadataList({
  children,
}: {
  children: React.ReactNode;
  columns?: "single";
  label?: { position: "start"; width: number };
}) {
  return <dl className="workspace-metadata">{children}</dl>;
}
export function MetadataListItem({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
export function Skeleton({
  index,
  width,
  height,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  index?: number;
  width?: React.CSSProperties["width"];
  height?: React.CSSProperties["height"];
}) {
  return (
    <div
      {...props}
      data-skeleton-index={index}
      className={cn("animate-pulse rounded-md bg-muted", className)}
      style={{ width, height }}
    />
  );
}
