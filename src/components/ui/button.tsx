"use client";

import * as React from "react";
import { Button as AstryxButton, type ButtonVariant } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";

/** The app's button, on Astryx's. It keeps the shape every screen was
 *  written against — `variant`, `size`, children, `asChild` for a link — and
 *  turns it into what Astryx wants: a `label` for the accessible name, a
 *  variant from its four, and IconButton for the icon-only sizes.
 *
 *  The accessible name is the text inside the button, or `aria-label` when
 *  there is none. Astryx requires one, and so does everybody using a screen
 *  reader on the deck. */

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type Size = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

const VARIANT: Record<Variant, ButtonVariant> = {
  default: "primary",
  outline: "secondary",
  secondary: "secondary",
  ghost: "ghost",
  destructive: "destructive",
  link: "ghost",
};

const SIZE: Record<Size, "sm" | "md" | "lg"> = {
  default: "md",
  xs: "sm",
  sm: "sm",
  lg: "lg",
  icon: "md",
  "icon-xs": "sm",
  "icon-sm": "sm",
  "icon-lg": "lg",
};

export type ButtonProps = Omit<React.ComponentProps<"button">, "color"> & {
  variant?: Variant;
  size?: Size;
  /** Render the child element's destination: `<Button asChild><Link href/></Button>`
   *  becomes an Astryx button that navigates. */
  asChild?: boolean;
  href?: string;
};

/** The words in a node, for the accessible name. */
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export function Button({
  variant = "default",
  size = "default",
  asChild = false,
  children,
  className,
  disabled,
  type = "button",
  title,
  onClick,
  href,
  ...rest
}: ButtonProps) {
  let content = children;
  let to = href;
  let click = onClick as React.MouseEventHandler<HTMLButtonElement> | undefined;

  if (asChild && React.isValidElement<{ href?: string; children?: React.ReactNode; onClick?: React.MouseEventHandler }>(children)) {
    to = children.props.href ?? to;
    content = children.props.children;
    click = (children.props.onClick as React.MouseEventHandler<HTMLButtonElement> | undefined) ?? click;
  }

  const ariaLabel = (rest as { "aria-label"?: string })["aria-label"];
  const text = textOf(content).trim();
  const label = ariaLabel || text || title || "Button";

  // `<Button><Icon /> Save</Button>` is how every call site writes an icon
  // beside its text. Astryx wants the icon in its own slot, so a lone
  // wordless element among the children moves there and the words become
  // the label. Anything more elaborate is passed through as it came.
  let icon: React.ReactNode;
  const parts = React.Children.toArray(content);
  const wordless = parts.filter((part) => React.isValidElement(part) && textOf(part).trim() === "");
  if (!size.startsWith("icon") && wordless.length === 1 && text) {
    icon = wordless[0];
    content = undefined;
  }

  if (size.startsWith("icon")) {
    return (
      <IconButton
        label={label}
        tooltip={title}
        icon={content}
        variant={VARIANT[variant]}
        size={SIZE[size]}
        isDisabled={disabled}
        onClick={click}
        className={className}
        {...(rest as Record<string, unknown>)}
      />
    );
  }

  return (
    <AstryxButton
      label={label}
      tooltip={title}
      variant={VARIANT[variant]}
      size={SIZE[size]}
      type={type}
      isDisabled={disabled}
      onClick={click}
      href={to}
      icon={icon}
      className={className}
      {...(rest as Record<string, unknown>)}
    >
      {content}
    </AstryxButton>
  );
}
