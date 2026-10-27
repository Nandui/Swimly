'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown, ChevronLeft, CircleHelp, House, LayoutGrid, type LucideIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { AccountMenu } from '@/components/ui/account-menu';
import { groupFrameModules, useFrame } from '@/components/ui/frame';
import { Glass } from '@/components/ui-kit/glass';

/** A page in the bar. The icon shows in the "More" menu; links handed over by a server page
 *  (the home page's) have none, because a component cannot cross to the client. */
export type ModuleLink = { href: string; label: string; icon?: LucideIcon; active: boolean };
export type ModuleLinkGroup = { label: string; links: ModuleLink[] };

/** The one frame every app opens in (DESIGN.md, The frame and navigation): on desktop the
 *  floating glass sidebar of the person's apps, with their account at its foot; on tablet the same
 *  as a rail of symbols; on phones a glass tab bar. Above the page a sticky toolbar holds the
 *  app's pages as a glass segmented control and the app's tools in a glass group. Links are
 *  presentation; every page checks its permission again. The pool deck and Help use the same
 *  tf-shell/tf-frame with their own top bar and no sidebar or tab bar. The person's apps and the
 *  app's extra tools come from the frame context (useFrame). On phones the page's large title
 *  collapses: once it scrolls under the toolbar, the page bar folds away and the toolbar becomes
 *  one glass row with the title inline in the middle and the page's way back on the leading side
 *  (useLargeTitle; kit.css shows it only under 768px). */
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
  const topRef = useRef<HTMLElement>(null);
  const inline = useLargeTitle(`${id}-main`, topRef, pathname);
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
      <Sidebar current={railCurrent} name={who.name} />
      <div className="tf-frame">
        <header ref={topRef} className="tf-top" data-titled={inline ? '' : undefined}>
          {inline?.back ? (
            <Glass shape="circle" className="tf-bar tf-inline-back">
              <Link href={inline.back.href} className="tf-bar-item" aria-label={`Back to ${inline.back.label}`}><ChevronLeft aria-hidden="true" /></Link>
            </Glass>
          ) : null}
          {inline ? <span className="tf-inline-title" aria-hidden="true">{inline.title}</span> : null}
          <Link href="/" className="tf-brand" aria-label="Turnfin home">
            <Image src="/brand/turnfin.png" alt="" width={72} height={72} priority />
          </Link>
          {/* A module with one page needs no page bar; its H1 names it. */}
          {pages.length > 1 ? (
            <nav ref={navRef} className="tf-pages" aria-label={`${module} pages`}>
              <span className="sr-only">{scopeNote}</span>
              <Glass className="tf-bar" data-measured={measured || undefined}>
                {pages.slice(0, fit).map((page) => (
                  <Link key={page.href} href={page.href} className="tf-bar-item" aria-current={currentFor(page)}>{page.label}</Link>
                ))}
                {fit < pages.length && <PagesMore groups={overflow} currentFor={currentFor} />}
              </Glass>
              {/* Every label at its natural width, unseen, so the bar can tell how many fit. */}
              <div ref={measureRef} className="tf-bar-measure" aria-hidden="true">
                {pages.map((page) => <span key={page.href} className="tf-bar-item">{page.label}</span>)}
                <span className="tf-bar-item">More<ChevronDown /></span>
              </div>
            </nav>
          ) : <span className="sr-only">{scopeNote}</span>}
          {/* On desktop the account is at the sidebar's foot, so this group shows only when the
              app or the frame adds a tool (kit.css). */}
          <Glass className="tf-bar tf-tools" role="group" aria-label="Search, site and account">
            {tools}
            {frame.tools}
            <AccountMenu name={who.name} />
          </Glass>
        </header>
        <main id={`${id}-main`} tabIndex={-1} className="tf-main">
          <div className={`tf-content ${contentClass}`}>{children}</div>
        </main>
      </div>
      <TabBar current={railCurrent} />
    </div>
  );
}

/** The page's large title, watched: once its H1 (every page has exactly one, in PageHeader) has
 *  scrolled up under the toolbar, its words and the header's way back (BackLink's `data-back`),
 *  else null. It looks for the H1 again whenever the page's content changes, as a page may draw
 *  its header after loading. */
function useLargeTitle(mainId: string, top: RefObject<HTMLElement | null>, pathname: string) {
  const [inline, setInline] = useState<{ title: string; back: { href: string; label: string } | null } | null>(null);
  useEffect(() => {
    const main = document.getElementById(mainId);
    if (!main) return;
    let observer: IntersectionObserver | null = null, watched: Element | null = null;
    const watch = () => {
      const h1 = main.querySelector('h1');
      if (h1 === watched) return;
      observer?.disconnect();
      watched = h1;
      setInline(null);
      if (!h1) return;
      const under = top.current?.offsetHeight ?? 0;
      observer = new IntersectionObserver(([entry]) => {
        const gone = !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
        const back = main.querySelector<HTMLAnchorElement>('[data-page-header] a[data-back]');
        setInline(gone ? { title: h1.textContent ?? '', back: back ? { href: back.getAttribute('href') ?? '/', label: back.dataset.back ?? '' } : null } : null);
      }, { rootMargin: `${-under}px 0% 0% 0%` });
      observer.observe(h1);
    };
    watch();
    const changes = new MutationObserver(watch);
    changes.observe(main, { childList: true, subtree: true });
    return () => { changes.disconnect(); observer?.disconnect(); };
  }, [mainId, top, pathname]);
  return inline;
}

/** As many page links as fit the bar, measured, so a link never scrolls out of sight; the rest go
 *  under "More". Until measured (the server render) the links that do not fit wrap out of
 *  sight below the 44px bar, and the open page's link goes first so it is never one of them
 *  (kit.css), so it never scrolls. */
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
      <DropdownMenuContent align="start" className="w-64 max-w-(--overlay-max-width)">
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

/** The person's apps (DESIGN.md, Sidebar): the fin to Home, Home, one "Apps" heading and their
 *  apps in the groups' order, Help, and their account at the foot. Symbols are the fin blue; the
 *  open app has the glass droplet. On tablet only the symbols show (kit.css): each keeps its name
 *  for screen readers and shows it on hover and focus. */
function Sidebar({ current, name }: { current: string; name: string }) {
  const { modules, groups } = useFrame();
  const apps = groupFrameModules(modules, groups).flatMap((group) => group.modules);
  const item = (key: string, href: string, label: string, Icon: LucideIcon) => (
    <Link key={key} href={href} className="tf-side-item" aria-current={current === key ? 'true' : undefined}>
      <Icon aria-hidden="true" /><span className="tf-side-label">{label}</span><span className="tf-side-tip" aria-hidden="true">{label}</span>
    </Link>
  );
  return (
    <Glass as="nav" shape="panel" className="tf-side" aria-label="Apps">
      <Link href="/" className="tf-side-brand" aria-label="Turnfin home">
        <Image src="/brand/turnfin.png" alt="" width={72} height={72} priority />
      </Link>
      <div className="tf-side-list">
        {item('home', '/', 'Home', House)}
        {apps.length > 0 && <p className="tf-side-heading">Apps</p>}
        {apps.map((m) => item(m.id, m.href, m.name, m.icon))}
        <a href="/help" target="_blank" rel="noopener noreferrer" className="tf-side-item">
          <CircleHelp aria-hidden="true" /><span className="tf-side-label">Help<span className="sr-only"> (opens in a new tab)</span></span><span className="tf-side-tip" aria-hidden="true">Help</span>
        </a>
      </div>
      <div className="tf-side-foot"><AccountMenu name={name} layout="sidebar" /></div>
    </Glass>
  );
}

/** Phones (DESIGN.md, Tab bar): a glass capsule with Home, the open app and Apps, which lists
 *  every app under its group, and Help. */
function TabBar({ current }: { current: string }) {
  const { modules, groups } = useFrame();
  const open = modules.find((m) => m.id === current);
  const item = (key: string, href: string, label: string, Icon: LucideIcon) => (
    <Link key={key} href={href} className="tf-bottom-item" aria-current={current === key ? 'true' : undefined}>
      <span className="tf-bottom-icon"><Icon aria-hidden="true" /></span><span>{label}</span>
    </Link>
  );
  return (
    <Glass as="nav" className="tf-bottom" aria-label="Apps">
      {item('home', '/', 'Home', House)}
      {open ? item(open.id, open.href, open.name, open.icon) : null}
      <DropdownMenu>
        <DropdownMenuTrigger className="tf-bottom-item"><span className="tf-bottom-icon"><LayoutGrid aria-hidden="true" /></span><span>Apps</span></DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64 max-w-(--overlay-max-width)">
          {groupFrameModules(modules, groups).map((group) => (
            <DropdownMenuGroup key={group.key}>
              <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">{group.label}</DropdownMenuLabel>
              {group.modules.map((m) => (
                <DropdownMenuItem key={m.id} asChild className="min-h-11"><Link href={m.href} aria-current={current === m.id ? 'true' : undefined}><m.icon aria-hidden="true" />{m.name}</Link></DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
          <DropdownMenuItem asChild className="min-h-11"><a href="/help" target="_blank" rel="noopener noreferrer"><CircleHelp aria-hidden="true" />Help<span className="sr-only"> (opens in a new tab)</span></a></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Glass>
  );
}
