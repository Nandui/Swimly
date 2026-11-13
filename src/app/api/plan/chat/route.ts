import { appRoute } from "@/lib/apps/switches";
import { handleChatEvent } from "@/modules/plan/features/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google Chat calls this when Plan (test)'s Chat app is added to a space or someone presses a
 *  button on a cover request (D30). Google signs each call; anything unsigned is refused. */
export const POST = appRoute("plan", handleChatEvent);
