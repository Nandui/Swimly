export type TeachingClaim = { coverById: string | null; coverByName: string };
export type ClaimState = "available" | "mine" | "locked";

/** A deleted teacher's claim remains locked; only an absent row is unclaimed. */
export function claimState(
  claim: TeachingClaim | null | undefined,
  userId: string,
): ClaimState {
  if (!claim) return "available";
  return claim.coverById === userId ? "mine" : "locked";
}
