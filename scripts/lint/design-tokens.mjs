// The UI rules (CLAUDE.md, "UI rules", owner rules of 10 and 20 October 2026): screens
// compose shadcn/ui and the app's theme. No literal colours (hex, rgb(), hsl(), oklch()…), no
// one-off lengths, no Tailwind arbitrary values such as p-[13px], text-[#333] or
// rounded-[var(--pc-radius-card)] (use the scale, a named theme utility, or a theme variable as
// rounded-(--name)), no inline styles, and every page's PageHeader inside its PageShell.
// Variants such as data-[state=open]: are selectors, not values, and stay allowed.

const hex = /(?:^|[^\w&#])(#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4}))(?![\w-])/i;
const colourFunction = /\b((?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[\d.][^)]*\)?)/i;
const pixels = /(?:^|[^\w.])(\d*\.?\d+px)\b/;
const bracket = /\[([^\]\s]+)\]/g;

// React reads a bare number in these style properties as a number, not pixels.
const unitless = new Set([
  "opacity", "zIndex", "flex", "flexGrow", "flexShrink", "order", "fontWeight", "lineHeight",
  "gridColumn", "gridRow", "gridColumnStart", "gridColumnEnd", "gridRowStart", "gridRowEnd",
  "columnCount", "aspectRatio", "scale", "zoom", "fillOpacity", "strokeOpacity", "animationIterationCount",
]);

/** The utility part of each class (after its variants) that takes a bracketed value, such as
 *  p-[13px] or [mask-type:alpha]. A class is split on the colons outside brackets; only the last
 *  part is the utility, so data-[state=open]:hidden passes. */
function arbitraryValues(text) {
  const found = [];
  for (const token of text.split(/\s+/)) {
    if (!token.includes("[")) continue;
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < token.length; i++) {
      const c = token[i];
      if (c === "[" || c === "(") depth++;
      else if (c === "]" || c === ")") depth--;
      else if (c === ":" && depth === 0) { parts.push(token.slice(start, i)); start = i + 1; }
    }
    const utility = token.slice(start);
    if (/^!?-?[a-z][\w-]*-\[[^\]]+\](\/[\w.]+)?!?$/.test(utility) || /^!?\[[\w-]+:[^\]]+\]!?$/.test(utility)) found.push(utility);
  }
  return found;
}

function problemsIn(text) {
  const problems = [];
  const colour = hex.exec(text)?.[1] ?? colourFunction.exec(text)?.[1];
  if (colour) problems.push({ messageId: "colour", data: { value: colour } });
  for (const value of arbitraryValues(text)) problems.push({ messageId: "arbitrary", data: { value } });
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
      arbitrary: "Arbitrary Tailwind value {{ value }}: use a Tailwind scale step, a named theme utility (src/app/shadcn.css) or a theme variable as (--name). Ask Fernando before adding a token (CLAUDE.md, UI rules).",
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

/** No inline styles (owner rule, 20 October 2026). The shadcn components themselves are exempt
 *  in eslint.config.mjs: they are the library, and set a few positions the library computes. */
const noInlineStyles = {
  meta: {
    type: "problem",
    docs: { description: "No style props: use Tailwind classes, theme utilities or a shadcn component." },
    schema: [],
    messages: {
      style: "No inline styles (CLAUDE.md, UI rules): use Tailwind classes and theme utilities. Sizes from data use the scale utilities in src/app/shadcn.css (w-37/100, col-start-12) or a shadcn component (Progress, Chart).",
    },
  },
  create(context) {
    return { "JSXAttribute[name.name='style']"(node) { context.report({ node, messageId: "style" }); } };
  },
};

/** Every page's PageHeader is the `header` of its PageShell (owner rule, 20 October 2026), so
 *  the H1, back link and actions sit in one place on every page. scripts/lint/ui-rules.mjs
 *  checks that every page renders a PageShell. */
const pageHeaderInShell = {
  meta: {
    type: "problem",
    docs: { description: "PageHeader is only ever the header of a PageShell." },
    schema: [],
    messages: {
      outside: "PageHeader goes in its page's PageShell: <PageShell header={<PageHeader … />}> (CLAUDE.md, UI rules).",
    },
  },
  create(context) {
    return {
      "JSXElement[openingElement.name.name='PageHeader']"(node) {
        let at = node.parent;
        while (at && ["ConditionalExpression", "LogicalExpression", "JSXExpressionContainer"].includes(at.type)) at = at.parent;
        const ok = at?.type === "JSXAttribute" && at.name.name === "header" && at.parent.name?.name === "PageShell";
        if (!ok) context.report({ node, messageId: "outside" });
      },
    };
  },
};

// Shared UI rules: primitives come from the local shadcn components, in Work, Turnfin Me and
// the Academy site alike.
export const uiImports = {
  paths: [{ name: "radix-ui", message: "Use the local shadcn component so theme, touch sizes and accessibility stay consistent." }],
  patterns: [{ group: ["@radix-ui/*", "@mui/*", "@mantine/*", "@headlessui/*", "antd", "antd/*"], message: "Use src/components/shadcn for UI primitives." }],
};
export const uiSyntax = [
  {
    selector: "JSXOpeningElement[name.name=/^(button|select|textarea|label|details|summary|dialog|progress|meter|table|thead|tbody|tfoot|tr|th|td|hr)$/]",
    message: "Use the installed shadcn primitive (or a shared ui composition) for this control.",
  },
  {
    selector: "JSXOpeningElement[name.name='svg']",
    message: "Draw charts with the shadcn Chart component (src/components/shadcn/chart.tsx) and icons with lucide-react, never hand-drawn SVG.",
  },
  {
    selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value='hidden']))",
    message: "Use shadcn Input, Checkbox, RadioGroup or Switch. Native hidden inputs are reserved for FormData bridges.",
  },
  {
    selector: "JSXOpeningElement[name.name=/^(div|span|a)$/]:has(JSXAttribute[name.name='role'][value.value=/^(button|checkbox|radio|switch|tab|tablist|dialog|alertdialog|progressbar|menu|menuitem|combobox|listbox)$/])",
    message: "Compose the matching shadcn component instead of building a custom interactive primitive.",
  },
];

const designTokens = { uiImports, uiSyntax, rules: { "no-literal-styles": noLiteralStyles, "no-inline-styles": noInlineStyles, "page-header-in-shell": pageHeaderInShell } };
export default designTokens;
