import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The white LeisureWorld logo for emails (assets/email/README.md), sent inside the
 *  message rather than linked, so it shows without loading anything from the web.
 *  Keep next.config.ts's output tracing for assets/email when moving it. */
export function emailLogo() {
  return readFile(join(process.cwd(), "assets/email/leisureworld-white-no-tagline.png"));
}
