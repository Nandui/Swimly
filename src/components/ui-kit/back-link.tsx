import { BreadcrumbItem, Breadcrumbs } from "@/components/workspace/typography";


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
