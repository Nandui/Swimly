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

// Turnfin is Core (people, roles, sites, audit), Work modules (Docs, Refunds,
// Training, HR, Rota) and Activities (Swim school first). See docs/architecture.md.
const activitiesFiles = [
  "src/modules/activities/**",
  // The Activities app (apps/activities) holds only routes.
  "apps/activities/src/**",
];
// Composition roots may import every module.
const compositionRoots = [
  "src/modules/server.ts",
  "src/modules/session-hooks.ts",
];
const tests = ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"];

// Import boundaries.
const notActivities = {
  group: ["@/modules/activities", "@/modules/activities/*", "**/modules/activities/**", "**/apps/activities/**"],
  message: "Core and Work modules must not import Activities. Register a contribution (src/modules/contributions.ts) or add to a composition root instead.",
};
const notWorkModules = {
  group: ["@/lib/docs/*", "@/lib/refunds/*", "@/lib/training/*", "@/lib/hr/*", "@/lib/rota/*", "@/components/docs/*", "@/components/refunds/*", "@/components/training/*", "@/components/hr/*", "@/components/rota/*"],
  message: "Activities depends on Core only, never on a Work module. Link to the module or add a Core seam.",
};

// Data boundaries (prisma/schema/*.prisma says which area owns each table).
const client = "/^(prisma|tx|db)$/";
const coreTables = "user|club|staffRole|organisation|department|userDepartment|roleAssignment|sharedDevice|sharedDeviceUser|qualificationType|qualification|qualificationEvidence|auditLog|staffSignInChallenge|staffSession|staffDetailChangeRequest|staffNotificationPreference|staffReminderLog";
const activitiesTables = "programme|level|competency|student|course|enrolment|studentFollowUp|attendanceRecord|classNote|classCancellation|cancelledClassSwimmer|classCover|competencyResult|levelCompletion|assessmentSession|assessmentType|assessmentBooking|parentAccount|parentAccessRequest|parentSession|parentSignInChallenge|parentRateLimit|parentChildAccess|parentAssessmentPublication|parentBookingRequest|parentProgressEvent|parentChangeRequest";
const activitiesData = [
  {
    selector: `MemberExpression[object.name=${client}][property.name=/^(${coreTables})$/]`,
    message: "Activities never queries Core tables. Use src/lib/directory.ts (people, sites) or another Core function.",
  },
  {
    selector: "Property[key.name=/^(include|select|where|orderBy)$/] Property[key.name=/^(instructor|club|markedBy|by|coverBy|assessedBy|confirmedBy|bookedBy)$/][value.type=/^(ObjectExpression|Literal)$/]",
    message: "Do not join Core tables (User, Club) from an Activities query. Select the id and add names with withSites/withStaff from src/lib/directory.ts.",
  },
];
const coreData = [
  {
    selector: `MemberExpression[object.name=${client}][property.name=/^(${activitiesTables})$/]`,
    message: "Core and Work modules never query Activities tables. Register a contribution in src/modules/contributions.ts instead.",
  },
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
    ignores: [...activitiesFiles, ...compositionRoots, ...tests, "src/components/shadcn/**", "src/generated/**"],
    rules: {
      "no-restricted-imports": ["error", { ...uiImports, patterns: [...uiImports.patterns, notActivities] }],
      "no-restricted-syntax": ["error", ...uiSyntax, ...coreData],
    },
  },
  {
    files: ["src/components/shadcn/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [notActivities] }] },
  },
  {
    files: activitiesFiles.map((glob) => `${glob}/*.{ts,tsx}`),
    ignores: tests,
    rules: {
      "no-restricted-imports": ["error", { ...uiImports, patterns: [...uiImports.patterns, notWorkModules] }],
      "no-restricted-syntax": ["error", ...uiSyntax, ...activitiesData],
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
    "apps/me/**",
    "apps/activities/.next/**",
    "apps/activities/next-env.d.ts",
    // Vendored skill assets and disposable browser audit bundles are not app code.
    ".agents/**",
    ".claude/**",
    "agent/skills/**",
    ".impeccable/review/**",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
