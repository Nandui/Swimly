/** The apps whose site picker (SiteSwitcher) remembers the site last picked, each in its own
 *  cookie. Per browser, like the working site (CLUB_COOKIE). It is only a preference: every page
 *  still checks the site against the sites the person covers. */
export const SITE_MEMORY_APPS = ["plan", "rota", "staffing", "tasks"] as const;
export type SiteMemoryApp = (typeof SITE_MEMORY_APPS)[number];
export const siteCookie = (app: SiteMemoryApp) => `turnfin.site.${app}`;
