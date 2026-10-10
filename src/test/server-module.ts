import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import ts from "typescript";

/** Run the real server action with explicit boundary doubles. Prisma and auth
 *  must be supplied: these tests cannot load credentials or reach a database. */
export function serverModule<T>(file: string, doubles: Record<string, unknown>): T {
  const cache = new Map<string, { exports: unknown }>();
  function load(filename: string): unknown {
    const cached = cache.get(filename);
    if (cached) return cached.exports;
    const testModule = { exports: {} };
    cache.set(filename, testModule);
    const nativeRequire = createRequire(filename);
    const localRequire = (id: string) => {
      if (Object.hasOwn(doubles, id)) return doubles[id];
      if (["@/lib/prisma", "@/auth", "@/lib/authz", "@/lib/clubs/current"].includes(id)) {
        throw new Error(`Server test must supply ${id}.`);
      }
      // The generated Prisma client is ESM (import.meta), so tsx loads it natively.
      if (id.startsWith("@/") && !id.startsWith("@/generated/")) {
        // A feature entry (index.ts) re-exports its React components; server
        // tests never render them, so a .tsx module loads as empty.
        const base = resolve(process.cwd(), "src", id.slice(2));
        if (existsSync(`${base}.ts`)) return load(`${base}.ts`);
        if (existsSync(`${base}/index.ts`)) return load(`${base}/index.ts`);
        if (existsSync(`${base}.tsx`)) return {};
        return load(`${base}.ts`);
      }
      return nativeRequire(id);
    };
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const evaluate = runInThisContext(`(function(require, module, exports) {\n${source}\n})`, { filename });
    evaluate(localRequire, testModule, testModule.exports);
    return testModule.exports;
  }
  return load(resolve(process.cwd(), file)) as T;
}
