import { Files } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const docsModule: ModuleManifest = {
  id: "docs",
  group: "team",
  name: "Docs",
  description: "Staff documents to read, write and approve, and who has read them",
  icon: Files,
  href: "/docs",
  logName: "Docs",
  access: {
    reach: "everywhere",
    levels: [
      { key: "read", label: "Read", help: "Read the documents aimed at their role.", permissions: ["docs.read"] },
      { key: "write", label: "Write", help: "Draft documents and send them for approval.", permissions: ["docs.write"] },
      { key: "manage", label: "Manage", help: "Aim documents at roles and see who has read them.", permissions: ["docs.manage"] },
    ],
    extras: [
      { key: "approve", label: "Can approve documents", help: "Approve and publish colleagues' documents, never their own.", from: "read", permissions: ["docs.approve"] },
    ],
  },
};
