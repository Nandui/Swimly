'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { ChevronDown, Loader2, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { Avatar, AvatarFallback, initials } from '@/components/shadcn/avatar';
import { useThemeMode } from '@/components/theme-provider';
import { useYourAccount } from '@/components/workspace/your-modules';
import { parseThemeMode } from '@/lib/theme-mode';
import { toast } from '@/lib/toast';

const MODES = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

/** The signed-in person: their avatar at the right of the top bar, opening
 *  who they are (name, role and working site), Appearance, Manage account and
 *  Sign out (V2Home-menu). Appearance lives here, with the account, not in the
 *  navigation; Help sits in the rail, the phone bar's More and the deck bar.
 *  The pool deck reuses it without Manage account (docs/instructor.md). Role
 *  and site come from the root layout through useYourAccount, so no shell
 *  passes them. Appearance is menu radio items, not the ThemeToggle radio
 *  group, because a menu cancels Tab: arrows must reach every choice. */
export function AccountMenu({ name, showManageAccount = true }: { name: string; showManageAccount?: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const { mode, setMode } = useThemeMode();
  const { role, site } = useYourAccount();
  const caption = [role, site].filter(Boolean).join(' · ');
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
      <DropdownMenuContent side="bottom" align="end" sideOffset={8} alignOffset={-4} className="tf-account-menu w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="flex items-center gap-3 p-0 font-normal">
          <Avatar size="lg" self aria-hidden="true"><AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
          <span className="min-w-0 break-words">
            <span className="block font-semibold">{name}</span>
            {caption ? <span className="block text-xs text-ui-muted-foreground">{caption}</span> : null}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuGroup className="flex flex-col gap-2">
          <DropdownMenuLabel className="p-0 text-xs font-semibold text-ui-muted-foreground">Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup aria-label="Appearance" className="tf-seg" value={mode} onValueChange={(value) => setMode(parseThemeMode(value))}>
            {MODES.map(({ value, label, Icon }) => (
              <DropdownMenuRadioItem key={value} value={value} className="tf-seg-item" onSelect={(event) => event.preventDefault()}><Icon aria-hidden="true" />{label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          {showManageAccount ? <DropdownMenuItem asChild className="tf-menu-item"><Link href="/account"><UserRound aria-hidden="true" />Manage account</Link></DropdownMenuItem> : null}
          <DropdownMenuItem className="tf-menu-item" onSelect={() => void leave()}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
