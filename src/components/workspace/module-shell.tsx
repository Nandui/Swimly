'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ChevronDown, CircleHelp, House, LayoutGrid, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { AccountMenu } from '@/components/workspace/account-menu';
import { RolePreviewToggle } from '@/components/staff/role-preview';
import { useYourModules } from '@/components/workspace/your-modules';

export type ModuleLink = { href: string; label: string; icon: LucideIcon; active: boolean };
export type ModuleLinkGroup = { label: string; links: ModuleLink[] };

/** Page links the top bar shows before the rest go under "More". */
const VISIBLE_PAGES = 7;

/** The one frame every module opens in (docs/how-turnfin-works.md, DESIGN.md "Poolside Clear
 *  v2"): the fin and the module's pages along the top, search, site and account on the right;
 *  the person's modules in an icon bar down the left (a labelled bar along the bottom on phones
 *  and touch screens). Links are presentation; every page checks its permission again. The pool
 *  deck keeps its own tablet frame. */
export function ModuleShell({ module, id, current = id, who, links = [], groups, tools, scopeNote, contentClass = 'module-content', maxWidth, scrollKey = '', children }: {
  /** Display name, e.g. "Training". */
  module: string;
  /** Short id for the scope class and landmarks, e.g. "training". */
  id: string;
  /** The module marked in the module bar ("home" on the home page). */
  current?: string;
  who: { id: string; name: string };
  /** The module's own pages, as one list… */
  links?: ModuleLink[];
  /** …or as several named groups (shown in order; the names are for the "More" menu). */
  groups?: ModuleLinkGroup[];
  /** Module controls in the top bar, e.g. the swim school's site and swimmer search. */
  tools?: ReactNode;
  /** A short note on whose records these are; read by screen readers with the page links. */
  scopeNote: string;
  pageLabel?: string;
  initialCollapsed?: boolean;
  /** Where the module's first page is; kept for callers, the fin always leads home. */
  base?: string;
  contentClass?: string;
  /** Caps the page's width; without it the page fills the frame. */
  maxWidth?: number;
  /** Scroll back to the top when this changes as well as the path (filters). */
  scrollKey?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname, scrollKey]);
  const pages = (groups ?? [{ label: '', links }]).flatMap((group) => group.links);
  const overflow = pages.length > VISIBLE_PAGES;
  const shown = overflow ? pages.slice(0, VISIBLE_PAGES - 1) : pages;
  const more = overflow ? pages.slice(VISIBLE_PAGES - 1) : [];
  const moreActive = more.some((page) => page.active);
  const railCurrent = current === 'core' ? 'admin' : current;

  return (
    <div className={`turnfin-docs turnfin-module turnfin-${id} tf-shell`}>
      <a className="skip-link" href={`#${id}-main`}>Skip to content</a>
      <div className="tf-frame">
        <header className="tf-top">
          <Link href="/" className="tf-brand" aria-label="Turnfin home">
            <Image src="/brand/turnfin.png" alt="" width={72} height={72} priority />
          </Link>
          {pages.length > 0 && (
            <nav className="tf-bar tf-pages" aria-label={`${module} pages`}>
              <span className="sr-only">{scopeNote}</span>
              {shown.map((page) => (
                <Link key={page.href} href={page.href} className="tf-bar-item" aria-current={page.active ? 'page' : undefined}>{page.label}</Link>
              ))}
              {overflow && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="tf-bar-item" aria-current={moreActive ? 'page' : undefined}>
                      {moreActive ? more.find((page) => page.active)?.label : 'More'}<ChevronDown aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)]">
                    {more.map((page) => (
                      <DropdownMenuItem key={page.href} asChild className="min-h-11">
                        <Link href={page.href} aria-current={page.active ? 'page' : undefined}><page.icon aria-hidden="true" />{page.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          )}
          <div className="tf-bar tf-tools" role="group" aria-label="Search, site and account">
            {tools}
            <RolePreviewToggle />
            <AccountMenu name={who.name} variant="bar" />
          </div>
        </header>
        <div className="tf-body">
          <ModuleRail current={railCurrent} />
          <main id={`${id}-main`} tabIndex={-1} className="tf-main">
            <div className={contentClass} style={maxWidth ? { maxWidth } : undefined}>{children}</div>
          </main>
        </div>
      </div>
      <ModuleBottomBar current={railCurrent} />
    </div>
  );
}

/** The person's modules, down the left on a desktop with a mouse. Each icon names itself on
 *  hover and on keyboard focus. */
function ModuleRail({ current }: { current: string }) {
  const modules = useYourModules();
  const item = (key: string, href: string, label: string, Icon: LucideIcon) => (
    <Link key={key} href={href} className="tf-rail-item" aria-label={label} aria-current={current === key ? 'page' : undefined}>
      <Icon aria-hidden="true" /><span className="tf-rail-label" aria-hidden="true">{label}</span>
    </Link>
  );
  return (
    <nav className="tf-rail" aria-label="Modules">
      <div className="tf-rail-group">{item('home', '/', 'Home', House)}{modules.map((m) => item(m.id, m.href, m.name, m.icon))}</div>
      <div className="tf-rail-group">
        <a href="/help" target="_blank" rel="noopener noreferrer" className="tf-rail-item" aria-label="Help (opens in a new tab)"><CircleHelp aria-hidden="true" /><span className="tf-rail-label" aria-hidden="true">Help</span></a>
      </div>
    </nav>
  );
}

/** Phones and touch screens: the modules along the bottom, each with its name, since touch has
 *  no hover. Home, up to three modules (the current one always among them) and More. */
function ModuleBottomBar({ current }: { current: string }) {
  const modules = useYourModules();
  const first = modules.slice(0, 3);
  const active = modules.find((m) => m.id === current);
  const chosen = active && !first.includes(active) ? [...first.slice(0, 2), active] : first;
  const rest = modules.filter((m) => !chosen.includes(m));
  const item = (key: string, href: string, label: string, Icon: LucideIcon) => (
    <Link key={key} href={href} className="tf-bottom-item" aria-current={current === key ? 'page' : undefined}>
      <span className="tf-bottom-icon"><Icon aria-hidden="true" /></span><span>{label}</span>
    </Link>
  );
  return (
    <nav className="tf-bottom" aria-label="Modules">
      {item('home', '/', 'Home', House)}
      {chosen.map((m) => item(m.id, m.href, m.name, m.icon))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="tf-bottom-item"><span className="tf-bottom-icon"><LayoutGrid aria-hidden="true" /></span><span>More</span></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64 max-w-[calc(100vw-2rem)]">
          {rest.map((m) => (
            <DropdownMenuItem key={m.id} asChild className="min-h-11"><Link href={m.href}><m.icon aria-hidden="true" />{m.name}</Link></DropdownMenuItem>
          ))}
          <DropdownMenuItem asChild className="min-h-11"><a href="/help" target="_blank" rel="noopener noreferrer"><CircleHelp aria-hidden="true" />Help<span className="sr-only"> (opens in a new tab)</span></a></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
