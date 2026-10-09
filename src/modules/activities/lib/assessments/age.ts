import { ageInYears } from "@/lib/format";

/** The ages an assessment session is for, in whole years on the session's date.
 *  Both ends are included; null leaves that end open. */
export type AgeRange = { minAge: number | null; maxAge: number | null };

/** "Ages 4 to 8", "Ages 4 and over", "Up to age 8", or null when any age goes. */
export function ageRangeLabel(range: AgeRange): string | null {
  const { minAge, maxAge } = range;
  if (minAge === null && maxAge === null) return null;
  if (minAge !== null && maxAge !== null) return minAge === maxAge ? `Age ${minAge}` : `Ages ${minAge} to ${maxAge}`;
  if (minAge !== null) return `Ages ${minAge} and over`;
  return `Up to age ${maxAge}`;
}

/** Why a swimmer cannot be assessed on a session of this kind, or null when
 *  they can. A range with no date of birth to check it against is refused: the
 *  desk adds the date, rather than the rule quietly not applying. */
export function ageRangeError(
  range: AgeRange | null | undefined,
  swimmer: { name: string; dateOfBirth: Date | null },
  sessionDate: Date
): string | null {
  const label = range ? ageRangeLabel(range) : null;
  if (!range || !label) return null;
  if (!swimmer.dateOfBirth) return `Add ${swimmer.name}'s date of birth first. The assessment is for ${lower(label)}.`;
  const age = ageInYears(swimmer.dateOfBirth, sessionDate);
  if ((range.minAge !== null && age < range.minAge) || (range.maxAge !== null && age > range.maxAge)) {
    return `${swimmer.name} is ${age} on the day of the assessment. It is for ${lower(label)}.`;
  }
  return null;
}

function lower(label: string) {
  return label.charAt(0).toLowerCase() + label.slice(1);
}
