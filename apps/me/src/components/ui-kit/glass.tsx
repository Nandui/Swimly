"use client";

import { useEffect, type ComponentProps, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Liquid Glass (DESIGN.md, The material), the one material for the functional layer: the
 *  sidebar, toolbars, the tab bar, sheets, menus and inspectors. Never on content, never on glass.
 *  The look is `.glass` in src/app/theme/kit.css; pages never style glass themselves. */

/** A lens map: neutral grey in the middle, ramping at the rim, so the edge of the glass bends
 *  what is behind it. rx and ry are the rim's share of the width and height; ax and ay how
 *  strongly it bends. Red carries x and green y, as feDisplacementMap reads them. */
function lensMap(rx: number, ry: number, ax: number, ay: number) {
  const byte = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  const hex = (v: number) => byte(v).toString(16).padStart(2, "0");
  const red = (v: number) => `#${hex(v)}0000`;
  const green = (v: number) => `#00${hex(v)}00`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" preserveAspectRatio="none"><defs>`
    + `<linearGradient id="r"><stop offset="0" stop-color="${red(128 + 127 * ax)}"/><stop offset="${rx}" stop-color="${red(128)}"/><stop offset="${1 - rx}" stop-color="${red(128)}"/><stop offset="1" stop-color="${red(128 - 128 * ax)}"/></linearGradient>`
    + `<linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="${green(128 + 127 * ay)}"/><stop offset="${ry}" stop-color="${green(128)}"/><stop offset="${1 - ry}" stop-color="${green(128)}"/><stop offset="1" stop-color="${green(128 - 128 * ay)}"/></linearGradient>`
    + `</defs><rect width="100" height="100" fill="url(#r)"/><rect width="100" height="100" fill="url(#g)" style="mix-blend-mode:screen"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The three lenses the design names: bars (capsules), circles and panels. */
const LENSES = [
  { id: "glass-lens-bar", map: lensMap(0.07, 0.3, 0.3, 1), scale: 0.16 },
  { id: "glass-lens-circle", map: lensMap(0.26, 0.26, 0.8, 0.8), scale: 0.25 },
  { id: "glass-lens-panel", map: lensMap(0.05, 0.015, 0.5, 0.15), scale: 0.1 },
];

/** Once per document, in the root layout: the lens filters that `.glass` refers to (Chromium
 *  bends glass edges through them; other browsers skip them) and the pointer light, which follows
 *  the mouse across every glass surface. The light is two custom properties on <html>, set here
 *  rather than through a style attribute; touch screens and Reduce transparency go without it. */
export function GlassRoot() {
  useEffect(() => {
    const root = document.documentElement;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) return;
    let frame = 0, x = 0, y = 0;
    const paint = () => { frame = 0; root.style.setProperty("--glass-x", `${x}px`); root.style.setProperty("--glass-y", `${y}px`); };
    const move = (event: PointerEvent) => { x = event.clientX; y = event.clientY; if (!frame) frame = requestAnimationFrame(paint); };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, []);
  return (
    <svg className="glass-defs" aria-hidden="true" focusable="false">
      {LENSES.map((lens) => (
        <filter key={lens.id} id={lens.id} x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
          <feImage href={lens.map} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={lens.scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      ))}
    </svg>
  );
}

type GlassProps<T extends ElementType> = {
  /** The element it renders as: a nav for the sidebar and tab bar, a section for a sheet. */
  as?: T;
  /** Which lens bends its edge: `bar` for capsules (the default), `circle` for one symbol,
   *  `panel` for tall surfaces such as the sidebar. */
  shape?: "bar" | "circle" | "panel";
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<T>, "as" | "className" | "children">;

/** A surface of the functional layer. The caller places it; the material is the kit's. */
export function Glass<T extends ElementType = "div">({ as, shape = "bar", className, children, ...rest }: GlassProps<T>) {
  const Element: ElementType = as ?? "div";
  return (
    <Element className={cn("glass", shape === "circle" && "glass-circle", shape === "panel" && "glass-panel", className)} {...rest}>
      {children}
    </Element>
  );
}
