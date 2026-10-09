import { readdirSync, readFileSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

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
// Each Work module's files: its folder, src/modules/<id>, and its routes.
const workArea = (id, ...extra) => [`src/modules/${id}/**`, `src/app/${id}/**`, ...extra];
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
const workImports = (ids) => ids.flatMap((id) => [`@/modules/${id}`, `@/modules/${id}/*`, `@/app/${id}/*`]);
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
// Work modules that read Core only through its functions (src/lib/directory.ts
// and the policy engine), never its tables: Phase 3 of
// docs/architecture/MIGRATION.md. Each module joins once its direct reads are
// gone, with the names of its relations to Core tables, so joins are caught too.
const coreThroughFunctions = {
  docs: [],
  refunds: [],
  purchasing: ["role", "site"],
  academy: ["organisation", "qualificationType", "qualification", "site", "tutor", "assessor", "user"],
  tasks: ["site"],
};
const coreJoins = (relations) => relations.length ? [{
  selector: `Property[key.name=/^(include|select|where|orderBy)$/] Property[key.name=/^(${relations.join("|")})$/][value.type=/^(ObjectExpression|Literal)$/]`,
  message: "Do not join Core tables from a module's query. Keep the id and ask src/lib/directory.ts for names.",
}] : [];
const workData = (self) => [
  ...notTables(Object.keys(moduleFiles).filter((id) => id !== self), "A module queries only its own tables and Core's. Ask the owning module through a seam (src/modules/contributions.ts)."),
  ...(coreThroughFunctions[self] ? [
    ...notTables(["core"], "This module reads Core through its functions (src/lib/directory.ts, src/lib/qualifications.ts, src/lib/policy), never Core tables."),
    ...coreJoins(coreThroughFunctions[self]),
  ] : []),
];

// Each module's public API and email files are its own. Shared plumbing (the
// public-API kit, the email sender) lives in Core: src/lib/public-api and
// src/lib/email. A module never imports another module's copy.
const modulePlumbing = [
  { owner: ["src/modules/academy/features/booking/**", "src/app/api/academy/**"], from: ["./src/modules/academy/features/booking/server"] },
  { owner: ["src/lib/staff-api/**", "src/app/api/staff/**"], from: ["./src/lib/staff-api/email.ts", "./src/lib/staff-api/http.ts"] },
  { owner: activitiesFiles, from: ["./src/modules/activities/shared/parents/email.ts", "./src/modules/activities/shared/parents/http.ts", "./src/modules/activities/shared/parents/sign-in-email.ts"] },
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

// The target architecture's dependency table (CLAUDE.md, section 3), in
// warning mode while the migration runs (docs/architecture/MIGRATION.md). The
// error-level rules above stay in force; these warnings show what is left.
// Elements are folders (first match wins); single files that sit outside their
// layer's folder are classified by file category instead.
const layerElements = [
  // A module's features and its shared folder, then the rest of the module
  // (index.ts, module.ts, and the lib/components folders of modules not yet
  // in the features shape).
  { type: "feature", pattern: "src/modules/*/features/*", capture: ["module", "feature"], partialMatch: false },
  { type: "module-shared", pattern: "src/modules/*/shared", capture: ["module"], partialMatch: false },
  { type: "module", pattern: "src/modules/*", capture: ["module"], partialMatch: false },
  { type: "ui", pattern: ["src/components/shadcn", "src/components/ui", "src/components/ui-kit"], partialMatch: false },
  // Screens that combine modules: the home page, the frame and Turnfin Me's API.
  { type: "front", pattern: ["src/components/home", "src/components/core", "src/components/workspace", "src/lib/staff-api"], partialMatch: false },
  { type: "platform", pattern: ["src/platform", "src/lib"], partialMatch: false },
  // Core's own screens (people, roles, sites, devices, help): the platform's admin UI.
  { type: "admin", pattern: "src/components", partialMatch: false },
  { type: "app", pattern: "src/app", partialMatch: false },
];
const layerFiles = [
  { category: "composition", pattern: ["src/modules/server.ts", "src/modules/session-hooks.ts", "src/lib/staff-api/records.ts", "src/lib/staff-api/reminders.ts"] },
  { category: "platform", pattern: ["src/modules/registry.ts", "src/modules/contributions.ts", "src/modules/context.ts", "src/modules/index.ts", "src/auth.ts", "src/lib/staff-api/notify.ts"] },
  { category: "ui", pattern: ["src/lib/utils.ts", "src/components/theme-provider.tsx", "src/components/theme-toggle.tsx", "src/components/form-dialog.tsx", "src/components/confirm-action.tsx", "src/components/searchable-picker.tsx"] },
  { category: "front", pattern: ["src/lib/home.ts", "src/lib/home-meta.ts"] },
];
const toEntry = { element: { type: "module", fileInternalPath: "index.ts" } };
const layerPolicies = [
  { from: { element: { type: "platform" } }, allow: { to: { element: { type: "platform" } } } },
  { from: { element: { type: "ui" } }, allow: { to: { element: { type: "ui" } } } },
  // A module's index.ts and module.ts use their own features; a feature uses
  // its own files and its module's shared folder, never a sibling feature.
  { from: { element: { type: "module" } }, allow: { to: [
    { element: { types: { anyOf: ["platform", "ui"] } } },
    { element: { types: { anyOf: ["module", "module-shared", "feature"] }, captured: { module: "{{ from.element.captured.module }}" } } },
    toEntry,
  ] } },
  { from: { element: { type: "module-shared" } }, allow: { to: [
    { element: { types: { anyOf: ["platform", "ui"] } } },
    { element: { type: "module-shared", captured: { module: "{{ from.element.captured.module }}" } } },
    toEntry,
  ] } },
  { from: { element: { type: "feature" } }, allow: { to: [
    { element: { types: { anyOf: ["platform", "ui"] } } },
    { element: { type: "module-shared", captured: { module: "{{ from.element.captured.module }}" } } },
    { element: { type: "feature", captured: { module: "{{ from.element.captured.module }}", feature: "{{ from.element.captured.feature }}" } } },
    toEntry,
  ] } },
  { from: { element: { types: { anyOf: ["front", "admin"] } } }, allow: { to: [{ element: { types: { anyOf: ["platform", "ui", "front", "admin"] } } }, toEntry] } },
  { from: { element: { type: "app" } }, allow: { to: [
    { element: { types: { anyOf: ["platform", "ui", "front", "admin", "app"] } } },
    toEntry,
    { element: { type: "feature", fileInternalPath: "index.ts" } },
  ] } },
  // Files classified on their own (layerFiles); later policies win.
  { allow: { to: { file: { categories: { anyOf: ["platform", "ui"] } } } } },
  { from: { element: { type: "ui" } }, disallow: { to: { file: { categories: "platform" } } } },
  { from: { file: { categories: "platform" } }, disallow: { to: { element: { types: { anyOf: ["module", "front", "admin", "app"] } } } } },
  { from: { file: { categories: "platform" } }, allow: { to: { element: { type: "platform" } } } },
  { from: { file: { categories: "front" } }, allow: { to: [{ element: { types: { anyOf: ["platform", "ui", "front", "admin"] } } }, toEntry] } },
  { from: { element: { types: { anyOf: ["front", "admin", "app"] } } }, allow: { to: { file: { categories: "front" } } } },
  { from: { element: { type: "app" } }, allow: { to: { file: { categories: "composition" } } } },
  // The platform loads the module wiring, as the registry loads app/modules.ts; front reads modules through it.
  { from: { element: { types: { anyOf: ["platform", "front"] } } }, allow: { to: { file: { categories: "composition" } } } },
  { from: { file: { categories: "front" } }, allow: { to: { file: { categories: "composition" } } } },
  { from: { file: { categories: "composition" } }, allow: { to: { element: { types: { anyOf: ["platform", "ui", "front", "module"] } } } } },
];

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
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [...tests, "src/generated/**"],
    plugins: { boundaries },
    settings: { "boundaries/elements": layerElements, "boundaries/files": layerFiles },
    rules: {
      "boundaries/dependencies": ["warn", {
        default: "disallow",
        message: "{{ from.element.types.[0] }} may not import {{ dependency.source }} (CLAUDE.md, section 3).",
        policies: layerPolicies,
      }],
    },
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
