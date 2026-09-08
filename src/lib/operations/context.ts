import { AsyncLocalStorage } from "node:async_hooks";
import type { Session } from "next-auth";

// Set only by the authenticated route, never by caller-supplied session data.
export const operationContext = new AsyncLocalStorage<{ session: Session; clubId: string }>();
