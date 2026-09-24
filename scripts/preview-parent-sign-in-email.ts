/** Render a synthetic sign-in email locally. Never contacts Google or a database. */
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parentSignInEmail, PARENT_EMAIL_LOGO_CID } from "../src/lib/parent/sign-in-email";

async function main() {
  const directory = join(process.cwd(), ".impeccable/review");
  const logo = await readFile(join(process.cwd(), "assets/email/leisureworld-white-no-tagline.png"));
  const html = parentSignInEmail("012345").html.replace(`cid:${PARENT_EMAIL_LOGO_CID}`, `data:image/png;base64,${logo.toString("base64")}`);
  const dark = html.replace("@media (prefers-color-scheme: dark)", "@media all");
  await mkdir(directory, { recursive: true });
  const output = join(directory, "parent-sign-in-email.html");
  await writeFile(output, html);
  await writeFile(join(directory, "parent-sign-in-email-dark.html"), dark);
  console.log(`Synthetic email preview: ${output}`);
  if (process.argv.includes("--serve")) {
    const server = createServer((request, response) => {
      if (request.method !== "GET" || !["/", "/dark"].includes(request.url ?? "")) {
        response.writeHead(404).end(); return;
      }
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(request.url === "/dark" ? dark : html);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address !== "string") console.log(`Email preview: http://127.0.0.1:${address.port} (use /dark for dark mode)`);
    });
  }
}

void main().catch(() => { console.error("Could not generate the synthetic email preview."); process.exitCode = 1; });
