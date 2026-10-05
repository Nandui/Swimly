'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { ChevronDown, CircleHelp, CircleUser, Loader2, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { Avatar, AvatarFallback, initials } from '@/components/shadcn/avatar';
import { useThemeMode } from '@/components/theme-provider';
import { parseThemeMode } from '@/lib/theme-mode';
import { toast } from '@/lib/toast';
import { greeting } from '@/lib/greeting';

/** The signed-in person: their avatar at the right of the frame's top bar,
 *  opening Appearance, Manage account, Help and Sign out. Appearance lives
 *  here, with the account, not in the navigation. */
export function AccountMenu({ name }: { name: string }) {
  const [leaving, setLeaving] = useState(false);
  const { mode, setMode } = useThemeMode();
  async function leave() {
    setLeaving(true);
    try { await signOut({ redirectTo: '/sign-in' }); }
    catch { setLeaving(false); toast.error('Could not sign out. Try again.'); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="tf-bar-item tf-who" aria-label={`Account menu: ${name}`} disabled={leaving}>
          {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Avatar self aria-hidden="true"><AvatarFallback>{initials(name)}</AvatarFallback></Avatar>}<ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="break-words"><span className="block text-xs font-normal text-ui-muted-foreground" suppressHydrationWarning>{greeting()}</span>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-ui-muted-foreground">Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(parseThemeMode(value))}>
          <DropdownMenuRadioItem value="system" className="min-h-11"><Monitor aria-hidden="true" />System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light" className="min-h-11"><Sun aria-hidden="true" />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="min-h-11"><Moon aria-hidden="true" />Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11"><Link href="/account"><CircleUser aria-hidden="true" />Manage account</Link></DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11"><Link href="/help" target="_blank" rel="noopener noreferrer"><CircleHelp aria-hidden="true" />Help<span className="sr-only"> (opens in a new tab)</span></Link></DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onSelect={() => void leave()}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
