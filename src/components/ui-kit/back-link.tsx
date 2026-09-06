import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";

/** Where a detail page sits: the list it came from, then the page itself.
 *  Astryx's breadcrumb, above the title, in its quiet variant. Two levels is
 *  the whole depth this app has. */
export function BackLink({
  href,
  children,
  current,
}: {
  href: string;
  /** The parent's name, as its page is titled. */
  children: React.ReactNode;
  /** This page's name. */
  current: React.ReactNode;
}) {
  return (
    <Breadcrumbs variant="supporting">
      <BreadcrumbItem href={href}>{children}</BreadcrumbItem>
      <BreadcrumbItem isCurrent>{current}</BreadcrumbItem>
    </Breadcrumbs>
  );
}
