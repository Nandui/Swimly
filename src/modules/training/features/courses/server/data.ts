import "server-only";
import { qualificationTypesOf } from "@/lib/qualifications";
import { requireTrainingActor } from "@/modules/training/shared/access";

export async function listQualificationTypeOptions() {
  const who = await requireTrainingActor();
  return (await qualificationTypesOf(who.orgId ?? null)).map(({ id, name, validityMonths }) => ({ id, name, validityMonths }));
}
