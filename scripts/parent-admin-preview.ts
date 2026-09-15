/** Loopback-only staff UI with the actual management API and isolated PostgreSQL. */
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { parentAdminFixture } from "../src/test/parent-admin-fixture";
import { dublinInstant } from "../src/lib/parent/time";
import { buildScreenshots } from "./help-screenshots/build.mjs";
import { createHmac, randomBytes } from "node:crypto";
import { serverModule } from "../src/test/server-module";

export async function startParentAdminPreview(port = 0) {
  if (process.env.PARENT_ADMIN_PREVIEW !== "1" || process.env.NODE_ENV === "production") throw new Error("Set PARENT_ADMIN_PREVIEW=1 for the isolated staff preview.");
  const output = path.resolve(".impeccable/review/parent-admin/site");
  await buildScreenshots({ entryPoint: "scripts/parent-admin-preview/fixture.jsx", outputDirectory: output, title: "Parent management · isolated preview" });
  const fixture = await parentAdminFixture();
  // Optional full parent-to-staff workflow, still entirely in-memory. Authentication
  // email endpoints are disabled; the checker installs this synthetic session cookie.
  const parentToken = randomBytes(32).toString("base64url");
  const secret = "synthetic-access-preview-secret-never-production";
  process.env.PARENT_API_ENABLED = "true";
  process.env.PARENT_AUTH_SECRET = secret;
  process.env.PARENT_API_ALLOWED_ORIGINS = "http://127.0.0.1:3020";
  await fixture.prisma.parentSession.updateMany({ data: { tokenHash: createHmac("sha256", secret).update(`session:${parentToken}`).digest("hex") } });
  const parentRouter = serverModule<typeof import("../src/lib/parent/router")>("src/lib/parent/router.ts", {
    "@/lib/prisma": { prisma: fixture.prisma }, "next/cache": { revalidatePath() {} },
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown" },
  });
  const data = { date: fixture.session.date.toISOString().slice(0, 10), startsAt: dublinInstant(fixture.session.date.toISOString().slice(0, 10), 960)!.toISOString(), instant: new Date().toISOString() };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, `http://127.0.0.1:${(server.address() as { port: number }).port}`);
      const parentPath = url.pathname.startsWith("/api/parent/v1/");
      if (parentPath && url.pathname.includes("/auth/")) { res.writeHead(403).end(); return; }
      if (url.pathname.startsWith("/api/parent-admin/v1/") || parentPath) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
        const handler = parentPath ? parentRouter.handleParentRequest : fixture.admin.handleParentAdminRequest;
        const response = await handler(new Request(url, {
          method: req.method, headers, ...(["GET", "HEAD"].includes(req.method!) ? {} : { body: Buffer.concat(chunks).toString("utf8") }),
        }), url.pathname.slice((parentPath ? "/api/parent/v1/" : "/api/parent-admin/v1/").length).split("/"));
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
      }
      if (!["GET", "HEAD"].includes(req.method!)) { res.writeHead(405).end(); return; }
      const name = url.pathname === "/" || url.pathname.startsWith("/students") ? "index.html" : url.pathname.slice(1);
      const file = path.resolve(output, name);
      if (!file.startsWith(output + path.sep)) { res.writeHead(403).end(); return; }
      let content: Buffer | string = await fs.readFile(file);
      if (name === "index.html") content = content.toString().replace('<script src="/fixture.js">', `<script>window.parentAdminDemo=${JSON.stringify(data)}</script><script src="/fixture.js">`);
      res.writeHead(200, { "Content-Type": ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png" } as Record<string, string>)[path.extname(file)] ?? "application/octet-stream" });
      res.end(content);
    } catch (error) { console.error("Isolated preview failed", error instanceof Error ? error.message : "Unknown error"); res.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(port, "127.0.0.1", resolve));
  return { ...fixture, parentToken, url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, output,
    close: async () => { await new Promise<void>(resolve => server.close(() => resolve())); await fixture.close(); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startParentAdminPreview(Number(process.env.PARENT_ADMIN_PORT ?? 4187)).then(preview => {
    console.log(`Isolated parent management preview: ${preview.url}`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
