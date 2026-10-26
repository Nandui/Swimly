'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Loader2, LogOut, Monitor, Moon, Sparkles, Sun, UserRound } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/shadcn/avatar';
import { useThemeMode } from '@/components/theme-provider';
import { useFrame } from '@/components/ui/frame';

const MODES = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

/** The signed-in person: their avatar at the right of the top bar, opening
 *  who they are (name, role and working site), Appearance, Manage account and
 *  What's new (the version and release notes) and Sign out (V2Home-menu). Appearance lives here, with the account, not in the
 *  navigation; Help sits in the rail, the phone bar's More and the deck bar.
 *  The pool deck reuses it without Manage account or What's new, its only desk links
 *. Role,
 *  site and signing out come from the root layout through the frame context
 *  (useFrame), so no shell passes them. Appearance is menu radio items, not the ThemeToggle radio
 *  group, because a menu cancels Tab: arrows must reach every choice. They
 *  wear the shared .pc-seg bar, so it looks the same as on /account. */
export function AccountMenu({ name, showManageAccount = true, layout = "bar" }: {
  name: string;
  showManageAccount?: boolean;
  /** `bar`: the avatar in a toolbar. `sidebar`: initials, name and "role · site" at the foot of
   *  the desktop sidebar (DESIGN.md, Sidebar), opening upwards. */
  layout?: "bar" | "sidebar";
}) {
  const [leaving, setLeaving] = useState(false);
  const { mode, setMode } = useThemeMode();
  const { role, site, picture, version, signOut } = useFrame();
  const photo = picture ? <AvatarImage src={picture} alt="" referrerPolicy="no-referrer" /> : null;
  const caption = [role, site].filter(Boolean).join(' · ');
  async function leave() {
    setLeaving(true);
    try { await signOut(); }
    catch { setLeaving(false); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="tf-bar-item tf-who" aria-label={`Account menu: ${name}`} disabled={leaving}>
          {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Avatar self aria-hidden="true">{photo}<AvatarFallback>{initials(name)}</AvatarFallback></Avatar>}
          {layout === "sidebar" ? (
            <span className="tf-who-text" aria-hidden="true"><span>{name}</span>{caption ? <span>{caption}</span> : null}</span>
          ) : <ChevronDown aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={layout === "sidebar" ? "top" : "bottom"} align={layout === "sidebar" ? "start" : "end"} className="tf-account-menu w-80 max-w-(--pc-overlay-max-width)">
        <DropdownMenuLabel className="flex items-center gap-3 p-0 text-sm font-normal text-ui-foreground">
          <Avatar size="lg" self aria-hidden="true">{photo}<AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
          <span className="min-w-0 break-words">
            <span className="block font-semibold">{name}</span>
            {caption ? <span className="block text-xs text-ui-muted-foreground">{caption}</span> : null}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuGroup className="flex flex-col gap-2">
          <DropdownMenuLabel className="p-0 text-xs font-semibold text-ui-muted-foreground">Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup aria-label="Appearance" className="pc-seg pc-seg-fill" value={mode} onValueChange={(value) => setMode(MODES.find((m) => m.value === value)?.value ?? 'system')}>
            {MODES.map(({ value, label, Icon }) => (
              <DropdownMenuRadioItem key={value} value={value} className="pc-seg-item" onSelect={(event) => event.preventDefault()}><Icon aria-hidden="true" />{label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          {showManageAccount ? <DropdownMenuItem asChild className="tf-menu-item"><Link href="/account"><UserRound aria-hidden="true" />Manage account</Link></DropdownMenuItem> : null}
          {showManageAccount ? (
            <DropdownMenuItem asChild className="tf-menu-item">
              <Link href="/whats-new"><Sparkles aria-hidden="true" />What&apos;s new{version ? <span className="ml-auto text-xs text-ui-muted-foreground">Version {version}</span> : null}</Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="tf-menu-item" onSelect={() => void leave()}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
