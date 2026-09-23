import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceptionPortal } from "@/components/portal/reception-portal";
import { pageSession } from "@/lib/page-guards";
import { getCurrentClub } from "@/lib/clubs/current";
import { RECEPTION_PORTAL_NAME, receptionPortalAccess } from "@/lib/reception-portal";
import '../docs/brand.css';
import './reception.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

export const metadata: Metadata = {
  title: { absolute: RECEPTION_PORTAL_NAME },
  icons: { icon: "/brand/turnfin.png", apple: "/brand/turnfin.png" },
};

export default async function ReceptionPortalPage() {
  const session = await pageSession();
  const access = receptionPortalAccess(session.user.permissions, session.user.screens);
  if (!access.available) notFound();
  const { club, clubs } = await getCurrentClub();
  return <ReceptionPortal userName={session.user.name ?? "Staff member"} access={access} club={club} clubs={clubs} />;
}
