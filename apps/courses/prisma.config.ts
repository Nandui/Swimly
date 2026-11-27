import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Courses shares Turnfin's main database and its one schema (docs/courses.md, Data). This
 *  config exists only to generate Courses' own client (`--generator courses`); migrations are
 *  written in ../../prisma/migrations and applied by Turnfin's build, never from here. */
export default defineConfig({
  schema: "../../prisma/schema",
  datasource: { url: process.env["DATABASE_URL"] ?? "postgresql://generate:only@127.0.0.1:5432/none" },
});
