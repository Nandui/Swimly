import "server-only";
import { z } from "zod";
import { members, type Member, type NewMember } from "@/modules/contributions";

/** Booking people from the swimmer records (owner request, 21 October 2026), for short courses
 *  and Academy courses alike: the desk picks someone already on the records, or adds them there
 *  first, and the booking keeps their swimmer id. The swim school owns the records; this module
 *  reads and adds through the member directory (src/modules/contributions.ts) and copies the name,
 *  phone, email and date of birth onto the booking, so My bookings and the emails still work.
 *  With the swim school switched off there is no directory, and the dialogs keep a typed name. */

const text = (max: number) => z.string().trim().max(max).default("");

export const newSwimmerSchema = z.object({
  firstName: text(60), lastName: text(60), dateOfBirth: text(10), memberNumber: text(40),
  contactName: text(120), contactEmail: text(200), contactPhone: text(40),
  emergencyName: text(120), emergencyPhone: text(40), emergencyRelationship: text(60), medicalNotes: text(2000),
});

/** Who the booking is for: someone on the records (`swimmerId`) or someone to add (`newSwimmer`). */
export const swimmerChoiceSchema = z.object({
  swimmerId: z.string().trim().max(60).default(""),
  newSwimmer: newSwimmerSchema.nullable().default(null),
});
export type SwimmerChoiceInput = z.input<typeof swimmerChoiceSchema>;
export type SwimmerChoice = z.output<typeof swimmerChoiceSchema>;

export const chose = (choice: SwimmerChoice) => Boolean(choice.swimmerId || choice.newSwimmer);

/** The swimmer the desk chose, added to the records first when they are new. Refuses when the
 *  records are switched off, the swimmer has gone, or the new one is already there. */
export async function resolveSwimmer(choice: SwimmerChoice, context: { siteId: string; by: { id: string; name: string }; via: string }):
  Promise<{ ok: true; swimmer: Member; added: boolean } | { ok: false; error: string }> {
  const directory = await members();
  if (!directory) return { ok: false, error: "The swimmer records are switched off, so nobody can be picked from them." };
  let id = choice.swimmerId, added = false;
  if (!id && choice.newSwimmer) {
    const made = await directory.create(choice.newSwimmer as NewMember, context);
    if (!made.ok) return made;
    id = made.id;
    added = true;
  }
  if (!id) return { ok: false, error: "Find the person on the swimmer records, or add them as a new swimmer." };
  const swimmer = (await directory.byIds([id], { medical: false })).get(id);
  if (!swimmer) return { ok: false, error: "That swimmer is no longer on the records. Search again." };
  return { ok: true, swimmer, added };
}

/** What a booking copies from the swimmer record. */
export function copiedFrom(swimmer: Member) {
  return {
    swimmerId: swimmer.id, name: `${swimmer.firstName} ${swimmer.lastName}`.trim(),
    email: swimmer.contactEmail ?? "", phone: swimmer.contactPhone ?? "",
    dateOfBirth: swimmer.dateOfBirth ? new Date(`${swimmer.dateOfBirth}T00:00:00Z`) : null,
  };
}

/** A place held online keeps the email and phone it was booked with: the email was checked with a
 *  code and is how the person sees it in My bookings, and the desk phones that number. */
export function keepBooked<T extends { email: string; phone: string }>(copy: T, booking: { source: string; email: string; phone: string } | null | undefined): T {
  if (booking?.source !== "online") return copy;
  return { ...copy, email: booking.email || copy.email, phone: booking.phone || copy.phone };
}

/** The swimmer records behind these bookings, with medical notes only when the viewer may read
 *  them (anyone working the course at its site: the desk books them, the instructor teaches them). */
export async function swimmersFor(ids: readonly (string | null)[], medical: boolean) {
  const directory = await members();
  const wanted = ids.filter((id): id is string => Boolean(id));
  return {
    available: Boolean(directory),
    byId: directory && wanted.length ? await directory.byIds(wanted, { medical }) : new Map<string, Member>(),
  };
}

/** What the course pages show of a person's swimmer record. */
export function swimmerView(swimmer: Member | undefined) {
  if (!swimmer) return null;
  return {
    id: swimmer.id, memberNumber: swimmer.memberNumber, name: `${swimmer.firstName} ${swimmer.lastName}`.trim(), dateOfBirth: swimmer.dateOfBirth,
    contactName: swimmer.contactName, contactEmail: swimmer.contactEmail, contactPhone: swimmer.contactPhone,
    emergencyName: swimmer.emergencyName, emergencyPhone: swimmer.emergencyPhone, emergencyRelationship: swimmer.emergencyRelationship,
    hasMedicalNotes: swimmer.hasMedicalNotes, medicalNotes: swimmer.medicalNotes,
  };
}
export type SwimmerView = NonNullable<ReturnType<typeof swimmerView>>;
