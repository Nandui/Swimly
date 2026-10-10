'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown, CircleHelp, House, LayoutGrid, type LucideIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { AccountMenu } from '@/components/ui/account-menu';
import { groupFrameModules, useFrame } from '@/components/ui/frame';

/** A page in the bar. The icon shows in the "More" menu; links handed over by a server page
 *  (the home page's) have none, because a component cannot cross to the client. */
export type ModuleLink = { href: string; label: string; icon?: LucideIcon; active: boolean };
export type ModuleLinkGroup = { label: string; links: ModuleLink[] };

/** The one frame every module opens in (docs/how-turnfin-works.md, DESIGN.md "Poolside Clear
 *  v2"): the fin and the module's pages along the top, search, site and account on the right;
 *  the person's modules in an icon bar down the left (a labelled bar along the bottom on phones
 *  and touch screens). Links are presentation; every page checks its permission again. The pool
 *  deck uses the same tf-shell/tf-frame with its own top bar and no rail or bottom bar. The
 *  person's modules and the app's extra tools come from the frame context (useFrame). */
export function ModuleShell({ module, id, current = id, who, links = [], groups, tools, scopeNote, contentClass = 'module-content', scrollKey = '', children }: {
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
  contentClass?: string;
  /** Scroll back to the top when this changes as well as the path (filters). */
  scrollKey?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const frame = useFrame();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname, scrollKey]);
  const pageGroups = groups ?? [{ label: '', links }];
  const pages = pageGroups.flatMap((group) => group.links);
  const navRef = useRef<HTMLElement>(null), measureRef = useRef<HTMLDivElement>(null);
  const { fit, measured } = useBarFit(navRef, measureRef, pages.length);
  const railCurrent = current === 'core' ? 'admin' : current;
  // Only the open page itself is the "page"; a link to one of its parents is "true".
  const currentFor = (page: ModuleLink) => !page.active ? undefined : pathname === page.href.split('?')[0] ? 'page' as const : 'true' as const;
  // The links past the fit, still under their group names, for "More".
  const overflow = pageGroups.reduce<{ start: number; groups: ModuleLinkGroup[] }>((acc, group) => {
    const hidden = group.links.filter((_, index) => acc.start + index >= fit);
    return { start: acc.start + group.links.length, groups: hidden.length ? [...acc.groups, { label: group.label, links: hidden }] : acc.groups };
  }, { start: 0, groups: [] }).groups;

  return (
    <div className={`turnfin-module turnfin-${id} tf-shell`}>
      <a className="skip-link" href={`#${id}-main`}>Skip to content</a>
      <div className="tf-frame">
        <header className="tf-top">
          <Link href="/" className="tf-brand" aria-label="Turnfin home">
            <Image src="/brand/turnfin.png" alt="" width={72} height={72} priority />
          </Link>
          {/* A module with one page needs no page bar; its H1 names it. */}
          {pages.length > 1 ? (
            <nav ref={navRef} className="tf-pages" aria-label={`${module} pages`}>
              <span className="sr-only">{scopeNote}</span>
              <div className="tf-bar" data-measured={measured || undefined}>
                {pages.slice(0, fit).map((page) => (
                  <Link key={page.href} href={page.href} className="tf-bar-item" aria-current={currentFor(page)}>{page.label}</Link>
                ))}
                {fit < pages.length && <PagesMore groups={overflow} currentFor={currentFor} />}
              </div>
              {/* Every label at its natural width, unseen, so the bar can tell how many fit. */}
              <div ref={measureRef} className="tf-bar-measure" aria-hidden="true">
                {pages.map((page) => <span key={page.href} className="tf-bar-item">{page.label}</span>)}
                <span className="tf-bar-item">More<ChevronDown /></span>
              </div>
            </nav>
          ) : <span className="sr-only">{scopeNote}</span>}
          <div className="tf-bar tf-tools" role="group" aria-label="Search, site and account">
            {tools}
            {frame.tools}
            <AccountMenu name={who.name} />
          </div>
        </header>
        <div className="tf-body">
          <ModuleRail current={railCurrent} />
          <main id={`${id}-main`} tabIndex={-1} className="tf-main">
            <div className={`tf-content ${contentClass}`}>{children}</div>
          </main>
        </div>
      </div>
      <ModuleBottomBar current={railCurrent} />
    </div>
  );
}

/** As many page links as fit the bar, measured, so a link never scrolls out of sight; the rest go
 *  under "More". Until measured (the server render) the links that do not fit wrap out of
 *  sight below the 44px bar, and the open page's link goes first so it is never one of them
 *  (poolside.css), so it never scrolls. */
function useBarFit(nav: RefObject<HTMLElement | null>, measure: RefObject<HTMLDivElement | null>, count: number) {
  const [fit, setFit] = useState(count);
  const [measured, setMeasured] = useState(false);
  useLayoutEffect(() => {
    const bar = nav.current, sizes = measure.current;
    if (!bar || !sizes) return;
    const update = () => {
      const widths = [...sizes.children].map((child) => child.getBoundingClientRect().width);
      const more = widths.pop() ?? 0;
      const room = bar.clientWidth - 8; // the bar's own 4px inset each side
      let used = 0, shown = 0;
      while (shown < count && used + widths[shown] + (shown + 1 < count ? more : 0) <= room) used += widths[shown++];
      setFit(Math.max(1, shown));
      setMeasured(true);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [nav, measure, count]);
  return { fit, measured };
}

/** The pages that do not fit the bar, under their group names. "More" keeps its short name so
 *  the bar never grows; it is filled when it holds the open page, which the page's H1 names. */
function PagesMore({ groups, currentFor }: { groups: ModuleLinkGroup[]; currentFor: (page: ModuleLink) => 'page' | 'true' | undefined }) {
  const active = groups.flatMap((group) => group.links).find((page) => page.active);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="tf-bar-item" aria-current={active ? 'true' : undefined} aria-label={active ? `More pages, including ${active.label}, the current page` : undefined}>
        More<ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-w-(--pc-overlay-max-width)">
        {groups.map((group) => (
          <DropdownMenuGroup key={group.label || group.links[0].href}>
            {group.label && <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">{group.label}</DropdownMenuLabel>}
            {group.links.map((page) => (
              <DropdownMenuItem key={page.href} asChild className="min-h-11 aria-[current]:bg-ui-accent aria-[current]:font-semibold aria-[current]:text-ui-accent-foreground">
                <Link href={page.href} aria-current={currentFor(page)}>{page.icon ? <page.icon aria-hidden="true" /> : null}{page.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The person's modules, down the left on a desktop with a mouse, one pill per group
 *  (MODULE_GROUPS). Each icon names itself on hover and on keyboard focus. */
function ModuleRail({ current }: { current: string }) {
  const { modules, groups } = useFrame();
  const item = (key: string, href: string, label: string, Icon: LucideIcon) => (
    <Link key={key} href={href} className="tf-rail-item" aria-label={label} aria-current={current === key ? 'true' : undefined}>
      <Icon aria-hidden="true" /><span className="tf-rail-label" aria-hidden="true">{label}</span>
    </Link>
  );
  return (
    <nav className="tf-rail" aria-label="Modules">
      <div className="tf-rail-group">{item('home', '/', 'Home', House)}</div>
      {groupFrameModules(modules, groups).map((group) => (
        <div key={group.key} role="group" aria-label={group.label} className="tf-rail-group">{group.modules.map((m) => item(m.id, m.href, m.name, m.icon))}</div>
      ))}
      <div className="tf-rail-group">
        <a href="/help" target="_blank" rel="noopener noreferrer" className="tf-rail-item" aria-label="Help (opens in a new tab)"><CircleHelp aria-hidden="true" /><span className="tf-rail-label" aria-hidden="true">Help</span></a>
      </div>
    </nav>
  );
}

/** Phones and touch screens: the modules along the bottom, each with its name, since touch has
 *  no hover. Home, up to three modules (the current one always among them) and More; with no
 *  modules left over, Help takes More's place. */
function ModuleBottomBar({ current }: { current: string }) {
  const { modules, groups } = useFrame();
  const first = modules.slice(0, 3);
  const active = modules.find((m) => m.id === current);
  const chosen = active && !first.includes(active) ? [...first.slice(0, 2), active] : first;
  const rest = modules.filter((m) => !chosen.includes(m));
  const item = (key: string, href: string, label: string, Icon: LucideIcon) => (
    <Link key={key} href={href} className="tf-bottom-item" aria-current={current === key ? 'true' : undefined}>
      <span className="tf-bottom-icon"><Icon aria-hidden="true" /></span><span>{label}</span>
    </Link>
  );
  return (
    <nav className="tf-bottom" aria-label="Modules">
      {item('home', '/', 'Home', House)}
      {chosen.map((m) => item(m.id, m.href, m.name, m.icon))}
      {rest.length === 0 ? (
        <a href="/help" target="_blank" rel="noopener noreferrer" className="tf-bottom-item">
          <span className="tf-bottom-icon"><CircleHelp aria-hidden="true" /></span><span>Help<span className="sr-only"> (opens in a new tab)</span></span>
        </a>
      ) : <DropdownMenu>
        <DropdownMenuTrigger className="tf-bottom-item"><span className="tf-bottom-icon"><LayoutGrid aria-hidden="true" /></span><span>More</span></DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64 max-w-(--pc-overlay-max-width)">
          {groupFrameModules(rest, groups).map((group) => (
            <DropdownMenuGroup key={group.key}>
              <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">{group.label}</DropdownMenuLabel>
              {group.modules.map((m) => (
                <DropdownMenuItem key={m.id} asChild className="min-h-11"><Link href={m.href}><m.icon aria-hidden="true" />{m.name}</Link></DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
          <DropdownMenuItem asChild className="min-h-11"><a href="/help" target="_blank" rel="noopener noreferrer"><CircleHelp aria-hidden="true" />Help<span className="sr-only"> (opens in a new tab)</span></a></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}
    </nav>
  );
}
