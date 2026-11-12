'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { FileText, UserRound } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/shadcn/command';
import { useFrame, type FrameSearchHit } from '@/components/ui/frame';
import type { ModuleLink } from '@/components/ui/module-shell';

/** The one search (D19; DESIGN.md, Search), opened from the sidebar's field, Ctrl K or the phone's
 *  search circle. It matches the person's apps and the open app's pages here, and asks the
 *  frame's search (the app hands it in) for people and records once two letters are typed. Each
 *  hit says what it is; opening one goes to its page, which checks permission again. */
export function SearchDialog({ open, onOpenChange, appName, pages }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appName: string | null;
  pages: readonly ModuleLink[];
}) {
  const router = useRouter();
  const { modules, search } = useFrame();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FrameSearchHit[]>([]);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef('');
  const q = query.trim().toLowerCase();
  // Typing asks for records after a short pause; a newer query replaces an older answer.
  const type = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    const asked = value.trim().toLowerCase();
    latest.current = asked;
    if (asked.length < 2 || !search) { setHits([]); return; }
    timer.current = setTimeout(() => startTransition(async () => {
      const found = await search(asked);
      if (latest.current === asked) setHits(found);
    }), 200);
  };
  const toggle = (next: boolean) => { if (!next) { clearTimeout(timer.current); latest.current = ''; setQuery(''); setHits([]); } onOpenChange(next); };

  const matches = (label: string) => !q || label.toLowerCase().includes(q);
  const appHits = modules.filter((m) => matches(m.name));
  const pageHits = pages.filter((p) => matches(p.label));
  const go = (href: string) => { toggle(false); router.push(href); };

  return (
    <CommandDialog open={open} onOpenChange={toggle} shouldFilter={false} title="Search Turnfin" description="Find an app, a page, a person or a swimmer">
      <CommandInput value={query} onValueChange={type} placeholder="Search apps, pages, people and swimmers" />
      <CommandList>
        <CommandEmpty>{pending ? 'Searching…' : q.length < 2 ? 'Type a name, a page or an app.' : `Nothing you can open matches “${query.trim()}”.`}</CommandEmpty>
        {pageHits.length && appName ? (
          <CommandGroup heading={appName}>
            {pageHits.map((page) => (
              <CommandItem key={page.href} value={`page:${page.href}`} onSelect={() => go(page.href)}>
                {page.icon ? <page.icon aria-hidden="true" /> : <FileText aria-hidden="true" />}{page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {appHits.length ? (
          <CommandGroup heading="Apps">
            {appHits.map((m) => (
              <CommandItem key={m.id} value={`app:${m.id}`} onSelect={() => go(m.href)}><m.icon aria-hidden="true" />{m.name}</CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {hits.length ? (
          <CommandGroup heading="People and swimmers">
            {hits.map((hit) => (
              <CommandItem key={hit.href} value={`hit:${hit.href}`} onSelect={() => go(hit.href)}>
                <UserRound aria-hidden="true" /><span className="flex min-w-0 flex-col"><span>{hit.label}</span><span className="text-footnote text-(--label-2)">{hit.hint}</span></span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
