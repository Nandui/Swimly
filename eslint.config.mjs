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
  "src/app/(activities)/**",
  "src/app/(instructor)/**",
  "src/app/api/parent/**",
  "src/app/api/parent-admin/**",
  "src/app/api/curriculum-images/**",
  "src/app/api/operations/**",
];
// Composition roots may import every module; the front desk (Reception Portal)
// composes the Activities Add swimmer dialog by design.
const compositionRoots = [
  "src/modules/server.ts",
  "src/modules/session-hooks.ts",
  "src/components/portal/reception-portal.tsx",
];
const tests = ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"];

// Import boundaries.
const notActivities = {
  group: ["@/modules/activities", "@/modules/activities/*", "@/app/(activities)/*", "@/app/(instructor)/*", "**/modules/activities/**"],
  message: "Core and Work modules must not import Activities. Register a contribution (src/modules/contributions.ts) or add to a composition root instead.",
};
const notWorkModules = {
  group: ["@/lib/docs/*", "@/lib/refunds/*", "@/lib/training/*", "@/lib/hr/*", "@/lib/rota/*", "@/lib/purchasing/*", "@/lib/academy/*", "@/lib/tasks/*", "@/components/docs/*", "@/components/refunds/*", "@/components/training/*", "@/components/hr/*", "@/components/rota/*", "@/components/purchasing/*", "@/components/academy/*", "@/components/tasks/*"],
  message: "Activities depends on Core only, never on a Work module. Link to the module or add a Core seam.",
};

// Data boundaries (prisma/schema/*.prisma says which area owns each table).
const client = "/^(prisma|tx|db)$/";
const coreTables = "user|club|siteArea|activityType|position|positionQualification|staffRole|organisation|department|userDepartment|roleAssignment|sharedDevice|sharedDeviceUser|qualificationType|qualification|qualificationEvidence|auditLog|staffSignInChallenge|staffSession|staffDetailChangeRequest|staffNotificationPreference|staffReminderLog";
const activitiesTables = "programme|level|competency|student|course|enrolment|studentFollowUp|attendanceRecord|classNote|classCancellation|cancelledClassSwimmer|classCover|competencyResult|levelCompletion|assessmentSession|assessmentType|assessmentBooking|parentAccount|parentAccessRequest|parentSession|parentSignInChallenge|parentRateLimit|parentChildAccess|parentAssessmentPublication|parentBookingRequest|parentProgressEvent|parentChangeRequest|classPlannedTeacher";
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

// Each module's public API and email files are its own. Shared plumbing (the
// public-API kit, the email sender) lives in Core: src/lib/public-api and
// src/lib/email. A module never imports another module's copy.
const modulePlumbing = [
  { owner: ["src/lib/academy/**", "src/app/api/academy/**"], from: ["./src/lib/academy/public"] },
  { owner: ["src/lib/staff-api/**", "src/app/api/staff/**"], from: ["./src/lib/staff-api/email.ts", "./src/lib/staff-api/http.ts"] },
  { owner: activitiesFiles, from: ["./src/modules/activities/lib/parent/email.ts", "./src/modules/activities/lib/parent/http.ts", "./src/modules/activities/lib/parent/sign-in-email.ts"] },
];
const plumbingRule = (skip) => ["error", {
  zones: modulePlumbing.filter((m) => m !== skip).flatMap((m) => m.from.map((from) => ({
    target: "./src",
    from,
    message: "That is another module's public API or email file. Use Core's src/lib/public-api or src/lib/email instead.",
  }))),
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
  // Module plumbing: each owner may use its own files, never another's.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: tests,
    rules: { "import/no-restricted-paths": plumbingRule(null) },
  },
  ...modulePlumbing.map((owner) => ({
    files: owner.owner.map((glob) => glob.endsWith("/**") ? `${glob}/*.{ts,tsx}` : glob),
    ignores: tests,
    rules: { "import/no-restricted-paths": plumbingRule(owner) },
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
