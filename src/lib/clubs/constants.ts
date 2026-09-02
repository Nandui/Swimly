/** The cookie that remembers which club somebody is working in. Per browser,
 *  not per account: the same person on the desk at one site and the deck at
 *  the other wants each device to stay where it was left. */
export const CLUB_COOKIE = "swimly.club";

/** The club the app was built for. Every row made before clubs existed
 *  belongs to it, and the import scripts from that era say so explicitly
 *  rather than leaning on a default that would hide a forgotten club. */
export const FOUNDING_CLUB_ID = "club_bishopstown";
