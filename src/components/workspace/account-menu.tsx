'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { ChevronsUpDown, CircleUser, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { Avatar } from '@/components/docs/ui';
import { toast } from '@/lib/toast';

/** The signed-in person, always at the foot of the sidebar: their name opens
 *  Account (manage your account) and Sign out. */
export function AccountMenu({ name, subtitle = 'Signed in', compact = false, onNavigate }: { name: string; subtitle?: string; compact?: boolean; onNavigate?: () => void }) {
  const [leaving, setLeaving] = useState(false);
  async function leave() {
    setLeaving(true);
    try { await signOut({ redirectTo: '/sign-in' }); }
    catch { setLeaving(false); toast.error('Could not sign out. Please try again.'); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? 'icon' : 'default'} className={compact ? 'workspace-account' : 'workspace-account w-full justify-start'} aria-label={`Account menu: ${name}`} title={compact ? name : undefined} disabled={leaving}>
          {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Avatar member={{ name }} />}
          {!compact && <><span className="workspace-account-text"><strong>{name}</strong><span>{leaving ? 'Signing out…' : subtitle}</span></span><ChevronsUpDown className="ml-auto" aria-hidden="true" /></>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="break-words">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11"><Link href="/account" onClick={onNavigate}><CircleUser aria-hidden="true" />Manage account</Link></DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => void leave()}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
