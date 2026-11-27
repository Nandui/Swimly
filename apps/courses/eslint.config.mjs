import { readdirSync, readFileSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Turnfin Courses stands alone (docs/courses.md). Two rules keep it that way:
//   1. nothing is imported from Turnfin's code (../../src);
//   2. the database client reaches only Courses' own tables, plus sites and people's names.
const SCHEMA = new URL("../../prisma/schema/", import.meta.url);
const OWNED = /^(courses|academy|activities(\..+)?)\.prisma$/;
/** Platform tables Courses may read, never write: sites, and the person behind an account. */
const READ_ONLY = ["club", "user"];
const delegate = (model) => model[0].toLowerCase() + model.slice(1);
const foreign = readdirSync(SCHEMA)
  .filter((file) => file.endsWith(".prisma") && !OWNED.test(file))
  .flatMap((file) => [...readFileSync(new URL(file, SCHEMA), "utf8").matchAll(/^model (\w+)/gm)].map((m) => delegate(m[1])))
  .filter((name) => !READ_ONLY.includes(name));
const WRITES = "create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mts}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { regex: "^(\\.\\./)+src/", message: "Turnfin Courses imports nothing from Turnfin's code (docs/courses.md)." },
          { regex: "generated/prisma", message: "Reach the database through @/data/db only." },
        ],
      }],
      "no-restricted-syntax": ["error",
        {
          selector: `MemberExpression[object.name=/^(db|tx)$/][property.name=/^(${foreign.join("|")})$/]`,
          message: "That table belongs to Turnfin, not to Courses (docs/courses.md, Data).",
        },
        {
          selector: `CallExpression[callee.property.name=/^(${WRITES})$/][callee.object.object.name=/^(db|tx)$/][callee.object.property.name=/^(${READ_ONLY.join("|")})$/]`,
          message: "Courses reads sites and people's names; it never writes them.",
        },
      ],
    },
  },
  // The one door to the generated client.
  { files: ["src/data/db.ts"], rules: { "no-restricted-imports": "off" } },
  globalIgnores([".next/**", "next-env.d.ts", "src/generated/**"]),
]);
