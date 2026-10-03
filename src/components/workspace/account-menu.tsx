'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { ChevronDown, ChevronsUpDown, CircleHelp, CircleUser, Loader2, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { Avatar } from '@/components/docs/ui';
import { useThemeMode } from '@/components/theme-provider';
import { parseThemeMode } from '@/lib/theme-mode';
import { toast } from '@/lib/toast';
import { greeting } from '@/lib/greeting';

/** The signed-in person: their avatar in the top bar (or a greeting over their
 *  name in the Docs sidebar), opening Appearance, Manage account, Help and
 *  Sign out. Appearance lives here, with the account, not in the navigation. */
export function AccountMenu({ name, compact = false, variant = 'sidebar', onNavigate }: { name: string; compact?: boolean; variant?: 'sidebar' | 'bar'; onNavigate?: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const { mode, setMode } = useThemeMode();
  async function leave() {
    setLeaving(true);
    try { await signOut({ redirectTo: '/sign-in' }); }
    catch { setLeaving(false); toast.error('Could not sign out. Please try again.'); }
  }
  const trigger = variant === 'bar'
    ? <Button variant="ghost" className="tf-bar-item tf-who" aria-label={`Account menu: ${name}`} disabled={leaving}>
        {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Avatar member={{ name }} />}<ChevronDown aria-hidden="true" />
      </Button>
    : <Button variant="ghost" size={compact ? 'icon' : 'default'} className={compact ? 'workspace-account' : 'workspace-account w-full justify-start'} aria-label={`Account menu: ${name}`} title={compact ? name : undefined} disabled={leaving}>
        {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Avatar member={{ name }} />}
        {!compact && <><span className="workspace-account-text"><span suppressHydrationWarning>{leaving ? 'Signing out…' : greeting()}</span><strong>{name}</strong></span><ChevronsUpDown className="ml-auto" aria-hidden="true" /></>}
      </Button>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side={variant === 'bar' ? 'bottom' : compact ? 'right' : 'bottom'} align={variant === 'bar' ? 'end' : 'start'} className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="break-words"><span className="block text-xs font-normal text-ui-muted-foreground" suppressHydrationWarning>{greeting()}</span>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(parseThemeMode(value))}>
          <DropdownMenuRadioItem value="system" className="min-h-11"><Monitor aria-hidden="true" />System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light" className="min-h-11"><Sun aria-hidden="true" />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="min-h-11"><Moon aria-hidden="true" />Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11"><Link href="/account" onClick={onNavigate}><CircleUser aria-hidden="true" />Manage account</Link></DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11"><Link href="/help" target="_blank" rel="noopener noreferrer"><CircleHelp aria-hidden="true" />Help<span className="sr-only"> (opens in a new tab)</span></Link></DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => void leave()}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
