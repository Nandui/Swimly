import "server-only";
import { canSee } from "@/lib/authz";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationState } from "@/lib/people/data";
import { QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { refundNumber, refundStatuses } from "@/lib/refunds/types";
import { trainingMine } from "@/modules/training/my";
import type { MyItem, MyProvider } from "./types";

/** My providers for the modules that exist today. Each reads only its own
 *  module's data, filtered to the signed-in person. Training, HR and Rota add
 *  theirs in their own module folders and are listed below. */

const date = (value: Date | string | null | undefined) =>
  value ? formatDate(typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value) : "";

export const READING_META = {
  overdue: { label: "Overdue", color: "red" },
  due: { label: "To read", color: "orange" },
} as const;

/** Docs: required reading still to acknowledge. Reads the Docs database
 *  through Docs' own functions, for this person only. */
const docsReading: MyProvider = {
  id: "docs.reading",
  moduleId: "docs",
  title: "Required reading",
  empty: "Nothing to read right now.",
  appliesTo: ({ session }) => canSee(session, "docs"),
  async load({ userId }) {
    const [{ database }, { requirements }, { overdue }] = await Promise.all([
      import("@/lib/docs/database"), import("@/lib/docs/domain"), import("@/lib/docs/types"),
    ]);
    const rows = await requirements(await database(), userId);
    return rows
      .filter((r) => r.status === "outstanding")
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
      .map((r): MyItem => ({
        id: r.id,
        title: r.title,
        detail: [r.reference, `Version ${r.version}`, r.dueDate ? `due ${date(r.dueDate)}` : "no deadline"].join(" · "),
        status: overdue(r.dueDate) ? READING_META.overdue : READING_META.due,
        href: `/docs/documents/${r.documentId}?version=${r.versionId}`,
        needsAction: true,
      }));
  },
};

/** Refunds: this person's own requests that still need something. */
const refundsMine: MyProvider = {
  id: "refunds.mine",
  moduleId: "refunds",
  title: "My refund requests",
  empty: "No open refund requests.",
  appliesTo: ({ session }) => canSee(session, "refunds"),
  async load({ userId }) {
    const rows = await prisma.refundRequest.findMany({
      where: { creatorId: userId, status: { in: ["DRAFT", "NEEDS_INFORMATION", "SUBMITTED", "APPROVED"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, number: true, status: true, customerName: true, updatedAt: true },
    });
    return rows.map((r) => {
      const status = refundStatuses[r.status as keyof typeof refundStatuses];
      return {
        id: r.id,
        title: `${refundNumber(r.number)} · ${r.customerName || "Unnamed draft"}`,
        detail: `Updated ${date(r.updatedAt)}`,
        status: status ? { label: status.label, color: status.color } : undefined,
        href: `/refunds/${r.id}`,
        needsAction: r.status === "DRAFT" || r.status === "NEEDS_INFORMATION",
      };
    });
  },
};

/** People core: this person's qualifications, soonest to expire first. */
const qualifications: MyProvider = {
  id: "people.qualifications",
  moduleId: "people",
  title: "My qualifications",
  empty: "No qualifications recorded. Ask your manager to record them once you have the certificate.",
  async load({ userId }) {
    const rows = await prisma.qualification.findMany({
      where: { userId, revokedAt: null },
      orderBy: [{ expiresOn: "asc" }],
      select: { id: true, issuedOn: true, expiresOn: true, revokedAt: true, reference: true, type: { select: { name: true } } },
    });
    return rows.map((q) => {
      const state = qualificationState(q);
      return {
        id: q.id,
        title: q.type.name,
        detail: q.expiresOn ? `Expires ${date(q.expiresOn)}` : `Issued ${date(q.issuedOn)} · does not expire`,
        status: QUALIFICATION_STATE_META[state],
        needsAction: state === "expiring" || state === "expired",
      };
    });
  },
};

const PROVIDERS: MyProvider[] = [trainingMine, docsReading, refundsMine, qualifications];

export function registerMyProvider(provider: MyProvider) {
  if (PROVIDERS.some((p) => p.id === provider.id)) throw new Error(`My provider ${provider.id} is registered twice.`);
  PROVIDERS.push(provider);
}

export function myProviders(): readonly MyProvider[] {
  return PROVIDERS;
}
