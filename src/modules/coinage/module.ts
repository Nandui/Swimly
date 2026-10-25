import "server-only";
import { registerHomeCard } from "@/modules/contributions";
import { coinageHomeItems } from "@/modules/coinage/features/queue/server/home";

/** Coinage's registration plug (AGENTS.md, The app contract), loaded by src/modules/server.ts: the home
 *  card. Its menu entry, levels and permissions are in manifest.ts. */
registerHomeCard({ moduleId: "coinage", items: coinageHomeItems });
