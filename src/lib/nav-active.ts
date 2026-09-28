/** Whether a sidebar link is the current page: an exact match, or a nested
 *  page under it, without prefix collisions (`/students-archive` is not
 *  `/students`). Shared by every workspace shell. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
