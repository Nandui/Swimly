import { readdirSync, readFileSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Shared UI rules: primitives come from the local shadcn components.
const uiImports = {
  paths: [{ name: "radix-ui", message: "Use the local shadcn component so theme, touch sizes and accessibility stay consistent." }],
  patterns: [{ group: ["@radix-ui/*", "@mui/*", "@mantine/*", "@headlessui/*", "antd", "antd/*"], message: "The staff app uses src/components/shadcn for UI primitives." }],
};
const uiSyntax = [
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
];

// Turnfin is a modular monolith: Core (people, roles, sites, audit) and modules
// (the swim school, called Activities here, and the Work modules). A module may
// import Core and itself, never another module; Core imports no module. Only a
// composition root may import every module. See docs/architecture.md.
const activitiesFiles = [
  "src/modules/activities/**",
  "src/app/(activities)/**",
  "src/app/(instructor)/**",
  "src/app/api/parent/**",
  "src/app/api/parent-admin/**",
  "src/app/api/curriculum-images/**",
  "src/app/api/operations/**",
];
// Each Work module's files: its lib, components and routes.
const workArea = (id, ...extra) => [`src/lib/${id}/**`, `src/components/${id}/**`, `src/app/${id}/**`, ...extra];
const workModules = {
  docs: workArea("docs", "src/app/api/docs/**"),
  refunds: workArea("refunds", "src/app/api/refunds/**"),
  training: workArea("training"),
  hr: workArea("hr"),
  rota: workArea("rota"),
  purchasing: workArea("purchasing"),
  academy: workArea("academy", "src/app/api/academy/**"),
  tasks: workArea("tasks", "src/app/api/cron/tasks/**"),
};
const moduleFiles = { activities: activitiesFiles, ...workModules };
const allModuleFiles = Object.values(moduleFiles).flat();
// Composition roots may import every module: the module wiring, and Turnfin
// Me's records and daily digest, which gather each person's things from every module.
const compositionRoots = [
  "src/modules/server.ts",
  "src/modules/session-hooks.ts",
  "src/lib/staff-api/records.ts",
  "src/lib/staff-api/reminders.ts",
];
const tests = ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"];
const lintable = (globs) => globs.map((glob) => glob.endsWith("/**") ? `${glob}/*.{ts,tsx}` : glob);

// Import boundaries.
const notActivities = {
  group: ["@/modules/activities", "@/modules/activities/*", "@/app/(activities)/*", "@/app/(instructor)/*", "**/modules/activities/**"],
  message: "Core and Work modules must not import Activities. Register a contribution (src/modules/contributions.ts) or add to a composition root instead.",
};
const workImports = (ids) => ids.flatMap((id) => [`@/lib/${id}`, `@/lib/${id}/*`, `@/components/${id}/*`, `@/app/${id}/*`]);
const notWork = (ids, message) => ({ group: workImports(ids), message });
const notWorkModules = notWork(Object.keys(workModules), "Activities depends on Core only, never on a Work module. Link to the module or add a Core seam.");
const notCoreToWork = notWork(Object.keys(workModules), "Core never imports a module. Register a contribution (src/modules/contributions.ts) or add to a composition root instead.");
const notOtherWork = (self) => notWork(Object.keys(workModules).filter((id) => id !== self), "A module never imports another module. Link to its screens, or add a Core seam (src/modules/contributions.ts).");
// The same rule by resolved path, so relative imports are caught too.
const moduleZones = Object.entries(moduleFiles).flatMap(([id, target]) => Object.entries(moduleFiles)
  .filter(([other]) => other !== id)
  .map(([other, from]) => ({ target, from, message: `${id} must not import ${other}: modules meet only through Core seams and composition roots.` })));

// Data boundaries: each prisma/schema/<owner>.prisma file says who owns its
// tables (core and base are Core's). A part queries only its own tables and
// Core's; Activities reads Core only through src/lib/directory.ts.
const schemaDir = new URL("./prisma/schema/", import.meta.url);
const tablesByOwner = {};
for (const file of readdirSync(schemaDir).filter((f) => f.endsWith(".prisma"))) {
  const owner = ["core.prisma", "base.prisma"].includes(file) ? "core" : file.replace(/\.prisma$/, "");
  const models = [...readFileSync(new URL(file, schemaDir), "utf8").matchAll(/^model (\w+)/gm)].map((m) => m[1][0].toLowerCase() + m[1].slice(1));
  tablesByOwner[owner] = [...(tablesByOwner[owner] ?? []), ...models];
}
for (const owner of Object.keys(tablesByOwner)) {
  if (owner !== "core" && !moduleFiles[owner]) throw new Error(`prisma/schema/${owner}.prisma has no module in eslint.config.mjs.`);
}
const client = "/^(prisma|tx|db)$/";
const tablesOf = (owners) => owners.flatMap((owner) => tablesByOwner[owner] ?? []);
const notTables = (owners, message) => {
  const tables = tablesOf(owners);
  return tables.length ? [{ selector: `MemberExpression[object.name=${client}][property.name=/^(${tables.join("|")})$/]`, message }] : [];
};
const activitiesData = [
  ...notTables(["core"], "Activities never queries Core tables. Use src/lib/directory.ts (people, sites) or another Core function."),
  ...notTables(Object.keys(workModules), "Activities never queries a Work module's tables."),
  {
    selector: "Property[key.name=/^(include|select|where|orderBy)$/] Property[key.name=/^(instructor|club|markedBy|by|coverBy|assessedBy|confirmedBy|bookedBy)$/][value.type=/^(ObjectExpression|Literal)$/]",
    message: "Do not join Core tables (User, Club) from an Activities query. Select the id and add names with withSites/withStaff from src/lib/directory.ts.",
  },
];
const coreData = notTables(Object.keys(moduleFiles), "Core never queries a module's tables. Register a contribution in src/modules/contributions.ts instead.");
const workData = (self) => notTables(Object.keys(moduleFiles).filter((id) => id !== self), "A module queries only its own tables and Core's. Ask the owning module through a seam (src/modules/contributions.ts).");

// Each module's public API and email files are its own. Shared plumbing (the
// public-API kit, the email sender) lives in Core: src/lib/public-api and
// src/lib/email. A module never imports another module's copy.
const modulePlumbing = [
  { owner: ["src/lib/academy/**", "src/app/api/academy/**"], from: ["./src/lib/academy/public"] },
  { owner: ["src/lib/staff-api/**", "src/app/api/staff/**"], from: ["./src/lib/staff-api/email.ts", "./src/lib/staff-api/http.ts"] },
  { owner: activitiesFiles, from: ["./src/modules/activities/lib/parent/email.ts", "./src/modules/activities/lib/parent/http.ts", "./src/modules/activities/lib/parent/sign-in-email.ts"] },
];
// One rule carries both: flat config replaces a rule's options rather than merging them.
const restrictedPaths = (skip) => ["error", {
  zones: [
    ...moduleZones,
    ...modulePlumbing.filter((m) => m !== skip).flatMap((m) => m.from.map((from) => ({
      target: "./src",
      from,
      message: "That is another module's public API or email file. Use Core's src/lib/public-api or src/lib/email instead.",
    }))),
  ],
}];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{jsx,tsx}"],
    ignores: ["src/components/shadcn/**", "src/generated/**"],
    rules: {
      "no-restricted-syntax": ["error", ...uiSyntax],
      "no-restricted-imports": ["error", uiImports],
    },
  },
  // Module boundaries. Each block repeats the UI rules: flat config replaces a
  // rule's options rather than merging them.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [...allModuleFiles, ...compositionRoots, ...tests, "src/components/shadcn/**", "src/generated/**"],
    rules: {
      "no-restricted-imports": ["error", { ...uiImports, patterns: [...uiImports.patterns, notActivities, notCoreToWork] }],
      "no-restricted-syntax": ["error", ...uiSyntax, ...coreData],
    },
  },
  {
    files: ["src/components/shadcn/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [notActivities, notCoreToWork] }] },
  },
  {
    files: lintable(activitiesFiles),
    ignores: tests,
    rules: {
      "no-restricted-imports": ["error", { ...uiImports, patterns: [...uiImports.patterns, notWorkModules] }],
      "no-restricted-syntax": ["error", ...uiSyntax, ...activitiesData],
    },
  },
  ...Object.entries(workModules).map(([id, globs]) => ({
    files: lintable(globs),
    ignores: tests,
    rules: {
      "no-restricted-imports": ["error", { ...uiImports, patterns: [...uiImports.patterns, notActivities, notOtherWork(id)] }],
      "no-restricted-syntax": ["error", ...uiSyntax, ...workData(id)],
    },
  })),
  // Module-to-module imports by path, and module plumbing: each owner may use
  // its own files, never another's.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: tests,
    rules: { "import/no-restricted-paths": restrictedPaths(null) },
  },
  ...modulePlumbing.map((owner) => ({
    files: lintable(owner.owner),
    ignores: tests,
    rules: { "import/no-restricted-paths": restrictedPaths(owner) },
  })),
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
