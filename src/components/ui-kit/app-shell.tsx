"use client";
import * as React from "react";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CircleUser,
  LogOut,
  Waves,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  Dialog,
  DialogHeader,
} from "@/components/workspace/overlays";
import { Button } from "@/components/workspace/actions";
import { Badge } from "@/components/workspace/feedback";
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};
export type AppShellProps = {
  wordmark: string;
  homeHref?: string;
  context?: string;
  items: NavItem[];
  userName: string;
  userSubtitle?: string;
  onSignOut?: () => void;
  switcher?: React.ReactNode;
  tools?: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
};
const OPERATIONS = new Set([
  "/",
  "/reception",
  "/today",
  "/courses",
  "/students",
  "/assessments",
  "/together",
]);
export function AppShell(props: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const active = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);
  const primary = ["/reception", "/today", "/students"]
    .flatMap((href) => props.items.filter((item) => item.href === href))
    .slice(0, 3);
  const nav = (mobile = false) => (
    <nav aria-label={mobile ? "All screens" : "Main navigation"}>
      {[true, false].map((operations) => {
        const items = props.items.filter(
          (item) => OPERATIONS.has(item.href) === operations,
        );
        return items.length ? (
          <div className="workspace-nav-group" key={String(operations)}>
            <p className="workspace-nav-heading">
              {operations ? "Workspace" : "Manage"}
            </p>
            {items.map((item) => (
              <NextLink
                key={item.href}
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className="workspace-nav-link"
              >
                <item.icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
                {item.badge ? <Badge variant="red" label={item.badge} /> : null}
              </NextLink>
            ))}
          </div>
        ) : null;
      })}
    </nav>
  );
  return (
    <div className="workspace-shell">
      <a className="workspace-skip" href="#main-content">
        Skip to content
      </a>
      <aside className="workspace-sidebar">
        <NextLink className="workspace-wordmark" href={props.homeHref ?? "/"}>
          <span>
            <Waves size={24} />
          </span>
          {props.wordmark}
        </NextLink>
        <div className="workspace-club">
          <span className="workspace-nav-heading">Current club</span>
          {props.switcher ?? props.context}
        </div>
        {nav()}
        <div className="workspace-sidebar-footer">
          <AccountMenu {...props} />
        </div>
      </aside>
      <div className="workspace-stage">
        <header className="workspace-topbar">
          <div className="workspace-mobile-brand">
            <Waves size={22} aria-hidden="true" />
            {props.switcher ?? (
              <strong>{props.context ?? props.wordmark}</strong>
            )}
          </div>
          <span className="workspace-desktop-context">{props.context}</span>
          <div className="flex items-center gap-2">
            {props.tools}
            <div className="workspace-mobile-account">
              <AccountMenu {...props} compact />
            </div>
          </div>
        </header>
        {props.banner}
        <main id="main-content" tabIndex={-1} className="workspace-main">
          {props.children}
        </main>
      </div>
      <nav className="workspace-bottom-nav" aria-label="Quick navigation">
        {primary.map((item) => (
          <NextLink
            href={item.href}
            key={item.href}
            aria-current={active(item.href) ? "page" : undefined}
          >
            <item.icon size={21} aria-hidden="true" />
            <span>{item.label}</span>
          </NextLink>
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="More screens"
          aria-haspopup="dialog"
        >
          <Menu size={21} />
          <span>More</span>
        </button>
      </nav>
      {menuOpen ? (
        <Dialog isOpen onOpenChange={setMenuOpen} width={420}>
          <DialogHeader
            title="Your workspace"
            subtitle={props.context}
            onOpenChange={setMenuOpen}
          />
          {nav(true)}
          <Button
            label="Close menu"
            icon={<X size={18} />}
            variant="secondary"
            onClick={() => setMenuOpen(false)}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
function AccountMenu({
  userName,
  userSubtitle,
  onSignOut,
  compact = false,
}: Pick<AppShellProps, "userName" | "userSubtitle" | "onSignOut"> & {
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <DropdownMenu
      hasChevron={false}
      placement="above"
      alignment="start"
      menuWidth={260}
      button={{
        label: `Account menu: ${userName}`,
        children: compact ? undefined : userName,
        variant: "ghost",
        width: compact ? undefined : "100%",
        isIconOnly: compact,
        className: compact ? undefined : "justify-start",
        icon: <CircleUser size={20} />,
      }}
      items={[
        {
          type: "section",
          title: userSubtitle ? `${userName} · ${userSubtitle}` : userName,
          items: [
            {
              id: "account",
              label: "Account",
              icon: CircleUser,
              onClick: () => router.push("/account"),
            },
            {
              id: "sign-out",
              label: "Sign out",
              icon: LogOut,
              onClick: onSignOut,
              isDisabled: !onSignOut,
            },
          ],
        },
      ]}
    />
  );
}
