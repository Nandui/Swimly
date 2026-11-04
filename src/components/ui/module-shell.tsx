'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, House, LayoutGrid, Search, Settings2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/shadcn/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { AccountMenu } from '@/components/ui/account-menu';
import { groupFrameModules, useFrame } from '@/components/ui/frame';
import { Glass } from '@/components/ui-kit/glass';
import { SearchDialog } from '@/components/ui/search-dialog';

/** A page of the open app (DESIGN.md, The frame and navigation; D19). Most pages are work pages,
 *  listed in the sidebar (five at most, checked by module-pages.test.ts). `setup` pages sit under
 *  the app's one Set up item, which only shows when the person may open one of them. Every other
 *  page sits `under` another and nests beneath it in the sidebar, like a folder, so every page
 *  has a place there. The icon shows in menus; links handed over by a server page have none,
 *  because a component cannot cross to the client. */
/** `folderEntry`: when pages nest under this one, its sidebar row becomes the folder's title
 *  (it opens and closes, never navigates) and the page itself is listed first inside, by this
 *  name ("Weekly classes" in the Timetable folder). */
export type ModuleLink = { href: string; label: string; icon?: LucideIcon; active: boolean; place?: 'setup'; under?: string; folderEntry?: string };
export type ModuleLinkGroup = { label: string; links: ModuleLink[] };

/** The one frame every app opens in (DESIGN.md, The frame and navigation; D19). One level of
 *  navigation is on screen at a time, and there are no top tabs:
 *  - On Home, the sidebar lists the person's apps. In an app, it drills in: "‹ Home", the app's
 *    name, its work pages, and Set up last. A person with exactly one app sees only its pages.
 *  - Phones have a tab bar instead: Home, the open app (which opens its pages) and Apps.
 *  Above the page a sticky toolbar holds the app's tools. Links are presentation; every page
 *  checks its permission again. On phones the page's large title collapses into the toolbar
 *  once it scrolls under it (useLargeTitle). */
export function ModuleShell({ module, id, current = id, who, links = [], groups, tools, scopeNote, contentClass = 'module-content', scrollKey = '', children }: {
  /** Display name, e.g. "Training". */
  module: string;
  /** Short id for the scope class and landmarks, e.g. "training". */
  id: string;
  /** The module marked in the sidebar ("home" on the home page). */
  current?: string;
  who: { id: string; name: string };
  /** The module's own pages, as one list… */
  links?: ModuleLink[];
  /** …or as several named groups (shown as one list, in order). */
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
  // The window scrolls on phones, the frame from tablet up (kit.css).
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => { window.scrollTo({ top: 0 }); frameRef.current?.scrollTo({ top: 0 }); }, [pathname, scrollKey]);
  const pages = (groups ?? [{ label: '', links }]).flatMap((group) => group.links);
  const topRef = useRef<HTMLElement>(null);
  const inline = useLargeTitle(`${id}-main`, topRef, pathname);
  const railCurrent = current === 'core' ? 'admin' : current;
  const app = railCurrent === 'home' ? null : { name: module, pages };
  // One search (D19): Ctrl K or ⌘K anywhere in the frame, the sidebar's field, or the phone's circle.
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearching(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`turnfin-module turnfin-${id} tf-shell`}>
      <a className="skip-link" href={`#${id}-main`}>Skip to content</a>
      <Sidebar current={railCurrent} name={who.name} app={app} scopeNote={scopeNote} pathname={pathname} onSearch={() => setSearching(true)} />
      <div ref={frameRef} className="tf-frame">
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
      <TabBar current={railCurrent} app={app} pathname={pathname} onSearch={() => setSearching(true)} />
      <SearchDialog open={searching} onOpenChange={setSearching} appName={app?.name ?? null} pages={app?.pages ?? []} />
    </div>
  );
}

type OpenApp = { name: string; pages: ModuleLink[] } | null;

/** The open page is "page"; a page whose part of the app is open (a record under a list) is
 *  "true". */
function currentFor(page: ModuleLink, pathname: string): 'page' | 'true' | undefined {
  if (page.active) return pathname === page.href.split('?')[0] ? 'page' : 'true';
  return undefined;
}

/** Whether a page starts a branch of the sidebar: it nests under nothing, or under a page this
 *  person cannot open, so nobody loses a page they may open. */
function atTop(page: ModuleLink, pages: ModuleLink[]): boolean {
  return !page.under || !pages.some((p) => p.href === page.under);
}

/** Whether the page or one of the pages nested under it is open, so its folder starts open. */
function within(page: ModuleLink, pages: ModuleLink[]): boolean {
  return page.active || pages.some((p) => p.under === page.href && within(p, pages));
}

/** How many folders deep a page sits; the phone's page list indents it by this (kit.css). */
function depth(page: ModuleLink, pages: ModuleLink[]): number {
  const parent = pages.find((p) => p.href === page.under);
  return parent ? 1 + depth(parent, pages) : 0;
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

/** The sidebar (DESIGN.md, Sidebar; D19), on the ground. On Home: the logo and name, Home, one
 *  "Apps" heading and the person's apps in the groups' order. In an app it drills in: "‹ Home"
 *  (unless the app is the person's only one), the app's name, its work pages and its Set up
 *  pages under one item that opens in place. Help and the account sit at the foot. */
function Sidebar({ current, name, app, scopeNote, pathname, onSearch }: { current: string; name: string; app: OpenApp; scopeNote: string; pathname: string; onSearch: () => void }) {
  const { modules, groups } = useFrame();
  const apps = groupFrameModules(modules, groups).flatMap((group) => group.modules);
  const only = modules.length === 1;
  const item = (key: string, href: string, label: string, Icon: LucideIcon | undefined, ariaCurrent: 'page' | 'true' | undefined) => (
    <Link key={key} href={href} className="tf-side-item" aria-current={ariaCurrent}>
      {Icon ? <Icon aria-hidden="true" /> : null}<span className="tf-side-label">{label}</span>
    </Link>
  );
  const work = app?.pages.filter((p) => !p.place && atTop(p, app.pages)) ?? [];
  const setup = app?.pages.filter((p) => p.place === 'setup') ?? [];
  /** A page with pages under it is a folder: its row is the title, which opens and closes, and
   *  the page itself is the first entry inside, so no row is both a page and a folder. */
  const page = (p: ModuleLink): ReactNode => {
    const subPages = app?.pages.filter((s) => s.under === p.href) ?? [];
    if (!subPages.length) return item(p.href, p.href, p.label, p.icon, currentFor(p, pathname));
    const open = within(p, app?.pages ?? []);
    return (
      <Collapsible key={p.href} className="tf-side-folder" defaultOpen={open}>
        <CollapsibleTrigger className="tf-side-item tf-side-folder-title" data-current={open || undefined}>
          {p.icon ? <p.icon aria-hidden="true" /> : null}<span className="tf-side-label">{p.label}</span><ChevronRight aria-hidden="true" className="tf-side-chevron" />
        </CollapsibleTrigger>
        <CollapsibleContent className="tf-side-tree">
          {item(p.href, p.href, p.folderEntry ?? p.label, p.icon, currentFor(p, pathname))}
          {subPages.map(page)}
        </CollapsibleContent>
      </Collapsible>
    );
  };
  return (
    <Glass as="nav" shape="panel" className="tf-side" aria-label={app ? `${app.name} pages` : 'Apps'}>
      <Link href="/" className="tf-side-brand" aria-label="Turnfin home">
        <span className="tf-brand"><Image src="/brand/turnfin.png" alt="" width={72} height={72} priority /></span>
        <span className="tf-side-brand-name" aria-hidden="true">Turnfin</span>
      </Link>
      <Button type="button" variant="ghost" className="tf-side-search" onClick={onSearch} aria-keyshortcuts="Control+K Meta+K">
        <Search aria-hidden="true" /><span>Search</span><kbd>Ctrl K</kbd>
      </Button>
      <div className="tf-side-list" key={app ? `app:${current}` : 'home'} data-drill={app ? 'in' : 'out'}>
        {app ? (
          <>
            {only ? null : (
              <Link href="/" className="tf-side-item tf-side-back"><ChevronLeft aria-hidden="true" /><span className="tf-side-label">Home</span></Link>
            )}
            <p className="tf-side-app">{app.name}<span className="sr-only">. {scopeNote}</span></p>
            {work.map(page)}
            {setup.length ? (
              <Collapsible className="tf-side-setup" defaultOpen={setup.some((p) => p.active)}>
                <CollapsibleTrigger className="tf-side-item" data-current={setup.some((p) => p.active) || undefined}>
                  <Settings2 aria-hidden="true" /><span className="tf-side-label">Set up</span><ChevronRight aria-hidden="true" className="tf-side-chevron" />
                </CollapsibleTrigger>
                <CollapsibleContent className="tf-side-setup-pages">
                  {setup.map((page) => item(page.href, page.href, page.label, undefined, currentFor(page, pathname)))}
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </>
        ) : (
          <>
            {item('home', '/', 'Home', House, current === 'home' ? 'page' : undefined)}
            {apps.length > 0 && <p className="tf-side-heading">Apps</p>}
            {apps.map((m) => item(m.id, m.href, m.name, m.icon, current === m.id ? 'true' : undefined))}
          </>
        )}
      </div>
      <div className="tf-side-foot">
        <a href="/help" target="_blank" rel="noopener noreferrer" className="tf-side-item">
          <CircleHelp aria-hidden="true" /><span className="tf-side-label">Help<span className="sr-only"> (opens in a new tab)</span></span>
        </a>
        <AccountMenu name={name} layout="sidebar" />
      </div>
    </Glass>
  );
}

/** Phones (DESIGN.md, Tab bar; D19): a white capsule with Home, the open app, which opens its
 *  pages, and Apps, which lists every app under its group, and Help; search is a white circle
 *  beside it. A person with one app has no Home or Apps: the app's tab holds its pages. */
function TabBar({ current, app, pathname, onSearch }: { current: string; app: OpenApp; pathname: string; onSearch: () => void }) {
  const { modules, groups } = useFrame();
  const only = modules.length === 1;
  const open = modules.find((m) => m.id === current) ?? (only ? modules[0] : undefined);
  const tab = (key: string, href: string, label: string, Icon: LucideIcon) => (
    <Link key={key} href={href} className="tf-bottom-item" aria-current={current === key ? 'page' : undefined}>
      <span className="tf-bottom-icon"><Icon aria-hidden="true" /></span><span>{label}</span>
    </Link>
  );
  const all = app?.pages ?? [];
  const pageItem = (page: ModuleLink, label = page.label, extra = 0) => (
    <DropdownMenuItem key={page.href} asChild className="min-h-11" data-depth={depth(page, all) + extra || undefined}>
      <Link href={page.href} aria-current={currentFor(page, pathname)}>{page.icon ? <page.icon aria-hidden="true" /> : null}{label}</Link>
    </DropdownMenuItem>
  );
  /** As in the sidebar, a folder is a title over its own page and the pages under it. */
  const inOrder = (p: ModuleLink): ReactNode[] => {
    const subPages = all.filter((s) => s.under === p.href);
    if (!subPages.length) return [pageItem(p)];
    return [
      <DropdownMenuLabel key={`${p.href}:folder`} className="text-xs font-semibold text-ui-muted-foreground" data-depth={depth(p, all) || undefined}>{p.label}</DropdownMenuLabel>,
      pageItem(p, p.folderEntry ?? p.label, 1),
      ...subPages.flatMap(inOrder),
    ];
  };
  const work = all.filter((p) => p.place !== 'setup' && atTop(p, all)).flatMap(inOrder);
  const setup = all.filter((p) => p.place === 'setup');
  return (
    <div className="tf-bottom-wrap">
    <Glass as="nav" className="tf-bottom" aria-label="Apps">
      {only ? null : tab('home', '/', 'Home', House)}
      {open ? (
        app && app.pages.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="tf-bottom-item" aria-current="true" aria-label={`${open.name} pages`}>
              <span className="tf-bottom-icon"><open.icon aria-hidden="true" /></span><span>{open.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" className="w-64 max-w-(--overlay-max-width)">
              <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">{open.name}</DropdownMenuLabel>
              {work}
              {setup.length ? (
                <DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">Set up</DropdownMenuLabel>
                  {setup.map((p) => pageItem(p))}
                </DropdownMenuGroup>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : tab(open.id, open.href, open.name, open.icon)
      ) : null}
      {only ? null : (
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
      )}
    </Glass>
    <Button type="button" variant="ghost" className="tf-bottom-search glass" onClick={onSearch} aria-label="Search"><Search aria-hidden="true" /></Button>
    </div>
  );
}
