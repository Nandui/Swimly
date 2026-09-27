import type { Session } from "next-auth";
import type { TagColor } from "@/components/ui-kit/tag";

/** The My hub's contract with each module.
 *
 *  A provider returns the signed-in person's own items from its own module's
 *  data, and nothing else: never another person's records, and never another
 *  module's tables. Self-service is not a capability, so a provider serves a
 *  person their own records whether or not they can open the module's Manage
 *  side. The hub runs every provider in parallel with a time limit; one that
 *  fails shows "couldn't load" without breaking the page. */

export type MyContext = {
  userId: string;
  orgId: string | null;
  session: Session;
};

export type MyItem = {
  id: string;
  title: string;
  /** One caption line: reference, dates, where. */
  detail?: string;
  /** From a module's status metadata map, never chosen at the call site. */
  status?: { label: string; color: TagColor };
  href?: string;
  /** Counts towards "things for you": something the person should act on. */
  needsAction?: boolean;
};

export type MyProvider = {
  id: string;
  /** The module this belongs to, for grouping and the section heading. */
  moduleId: string;
  title: string;
  /** Shown when the provider has nothing for this person. */
  empty: string;
  /** The person's full list in the module's My surface, e.g. finished training. */
  more?: { href: string; label: string };
  /** Whether this section applies to the person at all (for example, only
   *  people who can use Refunds see their refund requests). */
  appliesTo?(ctx: MyContext): boolean;
  load(ctx: MyContext): Promise<MyItem[]>;
};
