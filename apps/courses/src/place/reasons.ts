/** Why a place could not be made, in the desk's words, each saying what to do next. */
export const REFUSED: Record<string, string> = {
  gone: "That swimmer or class is no longer there. Pick again.",
  inactive: "This swimmer is marked inactive, so they cannot be placed.",
  archived: "That class, its level or its site has been archived. Pick another class.",
  already: "They are already in that class, or on its waiting list.",
  full: "That class has just filled. Pick another.",
  "not-earned": "They have not been placed at that level yet. Place them in Turnfin, which asks for the reason.",
  "other-site": "That class is at a different centre from the one that assessed them. Check with the family, then place them in Turnfin.",
};
