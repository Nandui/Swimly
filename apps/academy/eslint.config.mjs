import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import designTokens from "../../scripts/lint/design-tokens.mjs";

// The owner's UI rules (AGENTS.md, Screens, 20 October 2026) hold here as in Turnfin: shadcn
// components only, no arbitrary Tailwind values, no inline styles or new colours, and every page's
// PageHeader in its PageShell. The rules are Turnfin's (scripts/lint/design-tokens.mjs); `npm run lint`
// also runs scripts/lint/ui-rules.mjs. Never suppress them or disable them inline.
const { uiImports, uiSyntax } = designTokens;

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    // The browser theme colour in the root layout needs a colour value.
    ignores: ["src/app/layout.tsx"],
    plugins: { turnfin: designTokens },
    rules: { "turnfin/no-literal-styles": "error", "turnfin/page-header-in-shell": "error" },
  },
  // The shadcn components are the library: they set a few positions the library computes.
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/shadcn/**"],
    plugins: { turnfin: designTokens },
    rules: {
      "turnfin/no-inline-styles": "error",
      "no-restricted-syntax": ["error", ...uiSyntax],
      "no-restricted-imports": ["error", uiImports],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
