// The UI rule (CLAUDE.md, "UI rule"): screens compose shadcn/ui and the app's
// design tokens. No literal colours (hex, rgb(), hsl(), oklch()…) and no one-off
// lengths, including Tailwind arbitrary values such as w-[137px] or
// text-[#1a2b3c]. Token references such as rounded-[var(--pc-radius-card)] and
// variants such as data-[state=open]: are fine.

const hex = /(?:^|[^\w&#])(#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4}))(?![\w-])/i;
const colourFunction = /\b((?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[\d.][^)]*\)?)/i;
const length = /(?:^|[^\w.])(\d*\.?\d+(?:px|rem|em|vh|vw|dvh|svh|lvh|vmin|vmax|ch|ex|pt|cm|mm|in|%))(?!\w)/;
const pixels = /(?:^|[^\w.])(\d*\.?\d+px)\b/;
const tokenReference = /var\(--[\w-]+\)?/g;
const bracket = /\[([^\]\s]+)\]/g;

// React reads a bare number in these style properties as a number, not pixels.
const unitless = new Set([
  "opacity", "zIndex", "flex", "flexGrow", "flexShrink", "order", "fontWeight", "lineHeight",
  "gridColumn", "gridRow", "gridColumnStart", "gridColumnEnd", "gridRowStart", "gridRowEnd",
  "columnCount", "aspectRatio", "scale", "zoom", "fillOpacity", "strokeOpacity", "animationIterationCount",
]);

function problemsIn(text) {
  const problems = [];
  const colour = hex.exec(text)?.[1] ?? colourFunction.exec(text)?.[1];
  if (colour) problems.push({ messageId: "colour", data: { value: colour } });
  for (const [, inside] of text.matchAll(bracket)) {
    // min(100%, …) and w-[100%] are not one-off numbers.
    if (length.test(inside.replace(tokenReference, "").replaceAll("_", " ").replace(/(^|[^\d.])100%/g, "$1"))) {
      problems.push({ messageId: "arbitrary", data: { value: `[${inside}]` } });
    }
  }
  const px = pixels.exec(text.replace(bracket, ""))?.[1];
  if (px) problems.push({ messageId: "length", data: { value: px } });
  return problems;
}

const noLiteralStyles = {
  meta: {
    type: "problem",
    docs: { description: "Use design tokens and shadcn components, never literal colours or one-off lengths." },
    schema: [],
    messages: {
      colour: "Literal colour {{ value }}: use a colour token (ui- utilities or --pc-* variables). Ask Fernando before adding a token (CLAUDE.md, UI rule).",
      arbitrary: "Arbitrary value {{ value }}: use a Tailwind scale step or a token such as [var(--pc-…)]. Ask Fernando before adding a token (CLAUDE.md, UI rule).",
      length: "One-off length {{ value }}: use a spacing or size token. Ask Fernando before adding a token (CLAUDE.md, UI rule).",
    },
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text !== "string") return;
      for (const problem of problemsIn(text)) context.report({ node, ...problem });
    };
    return {
      Literal(node) { check(node, node.value); },
      TemplateElement(node) { check(node, node.value.cooked); },
      // sideOffset={8}, offset={80}: Radix and Sonner position in pixels.
      "JSXAttribute[name.name=/^(sideOffset|alignOffset|collisionPadding|offset|mobileOffset)$/] Literal"(node) {
        if (typeof node.value !== "number" || node.value === 0) return;
        const attribute = context.sourceCode.getAncestors(node).findLast((n) => n.type === "JSXAttribute");
        context.report({ node, messageId: "length", data: { value: `${attribute.name.name}: ${node.value}` } });
      },
      // style={{ width: 120 }}: React adds px to a bare number.
      "JSXAttribute[name.name='style'] Property > Literal.value"(node) {
        const key = node.parent.key.name ?? node.parent.key.value;
        if (typeof node.value === "number" && node.value !== 0 && !unitless.has(key)) {
          context.report({ node, messageId: "length", data: { value: `${key}: ${node.value}` } });
        }
      },
    };
  },
};

const designTokens = { rules: { "no-literal-styles": noLiteralStyles } };
export default designTokens;
