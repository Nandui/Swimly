import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Shared UI rule: primitives come from the local shadcn components.
const uiImports = {
  paths: [{ name: "radix-ui", message: "Use the local shadcn component so theme, touch sizes and accessibility stay consistent." }],
  patterns: [{ group: ["@radix-ui/*", "@mui/*", "@mantine/*", "@headlessui/*", "antd", "antd/*"], message: "The staff app uses src/components/shadcn for UI primitives." }],
};

// Turnfin is Core (people, roles, sites, audit), Work modules (Docs, Refunds,
// Training, HR, Rota) and Aquatics. See docs/architecture.md.
const aquaticsFiles = [
  "src/modules/aquatics/**",
  "src/app/(aquatics)/**",
  "src/app/(instructor)/**",
  "src/app/api/parent/**",
  "src/app/api/parent-admin/**",
  "src/app/api/curriculum-images/**",
  "src/app/api/operations/**",
];
// Composition roots may import every module; the front desk (Reception Portal)
// composes Aquatics' Add swimmer dialog by design.
const compositionRoots = [
  "src/modules/server.ts",
  "src/modules/session-hooks.ts",
  "src/components/portal/reception-portal.tsx",
];
const tests = ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"];
const notAquatics = {
  group: ["@/modules/aquatics", "@/modules/aquatics/*", "@/app/(aquatics)/*", "@/app/(instructor)/*", "**/modules/aquatics/**"],
  message: "Core and Work modules must not import Aquatics. Register a contribution (src/modules/contributions.ts) or add to a composition root instead.",
};
const notWorkModules = {
  group: ["@/lib/docs/*", "@/lib/refunds/*", "@/lib/training/*", "@/lib/hr/*", "@/lib/rota/*", "@/components/docs/*", "@/components/refunds/*", "@/components/training/*", "@/components/hr/*", "@/components/rota/*"],
  message: "Aquatics depends on Core only, never on a Work module. Link to the module or add a Core seam.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{jsx,tsx}"],
    ignores: ["src/components/shadcn/**", "src/generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^(button|select|textarea|label|details|summary|dialog|progress|meter|table|thead|tbody|tfoot|tr|th|td|hr)$/]",
          message: "Use the installed shadcn primitive (or a shared ui composition) for this control.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'][value.value='hidden']))",
          message: "Use shadcn Input, Checkbox, RadioGroup or Switch. Native hidden inputs are reserved for FormData bridges.",
        },
        {
          selector: "JSXOpeningElement[name.name=/^(div|span|a)$/]:has(JSXAttribute[name.name='role'][value.value=/^(button|checkbox|radio|switch|tab|tablist|dialog|alertdialog|progressbar|menu|menuitem|combobox|listbox)$/])",
          message: "Compose the matching shadcn component instead of building a custom interactive primitive.",
        },
      ],
      "no-restricted-imports": ["error", uiImports],
    },
  },
  // Module boundaries. Each block repeats the UI rule: flat config replaces a
  // rule's options rather than merging them.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [...aquaticsFiles, ...compositionRoots, ...tests, "src/components/shadcn/**", "src/generated/**"],
    rules: { "no-restricted-imports": ["error", { ...uiImports, patterns: [...uiImports.patterns, notAquatics] }] },
  },
  {
    files: ["src/components/shadcn/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [notAquatics] }] },
  },
  {
    files: aquaticsFiles.map((glob) => `${glob}/*.{ts,tsx}`),
    ignores: tests,
    rules: { "no-restricted-imports": ["error", { ...uiImports, patterns: [...uiImports.patterns, notWorkModules] }] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Turnfin Me is its own app with its own lint (apps/me).
    "apps/**",
    // Vendored skill assets and disposable browser audit bundles are not app code.
    ".agents/**",
    ".claude/**",
    "agent/skills/**",
    ".impeccable/review/**",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
