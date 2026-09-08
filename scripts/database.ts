import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const config = JSON.parse(readFileSync(resolve(".vercel/swimly-operations.json"), "utf8")) as { url: string; token: string };
  const url = new URL(config.url);
  if (url.origin !== "https://swimly-lw.vercel.app" || url.pathname !== "/api/operations") throw new Error("Unexpected operations destination.");
  const [command, file] = process.argv.slice(2);
  if (command !== "check" && (command !== "run" || !file)) throw new Error("Use db:check, or db:run -- <private-request.json>.");
  const body = command === "check" ? { operation: "check" } : JSON.parse(readFileSync(resolve(file), "utf8"));
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(60000) });
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok || result.ok === false || result.error) process.exitCode = 1;
}
main().catch(() => { console.error("Command failed. Check local operator configuration and connectivity; read records before retrying a write."); process.exitCode = 1; });
