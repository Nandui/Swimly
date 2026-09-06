import { readFileSync } from "node:fs";
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
      if (id.startsWith("@/")) return load(resolve(process.cwd(), "src", `${id.slice(2)}.ts`));
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
