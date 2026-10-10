export type TeachingClaim = { coverById: string | null; coverByName: string };
export type ClaimState = "available" | "mine" | "shared";

/** A start records who began the session; it never excludes another instructor. */
export function claimState(
  claim: TeachingClaim | null | undefined,
  userId: string,
): ClaimState {
  if (!claim) return "available";
  return claim.coverById === userId ? "mine" : "shared";
}
