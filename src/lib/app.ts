/** The working product name. Keep identity and browser titles in sync. */
export const APP_NAME = "Turnfin";

/** Every tab title is "<page name> · Turnfin". A layout that sets a title must
 *  also set this template, or the pages under it lose the brand suffix. */
export const TITLE_TEMPLATE = `%s · ${APP_NAME}`;

/** The version staff see on What's new and in the account menu: package.json's, which every
 *  change bumps with its CHANGELOG.md entry. next.config.ts hands it to the build. */
export const APP_VERSION = process.env.APP_VERSION ?? "";
