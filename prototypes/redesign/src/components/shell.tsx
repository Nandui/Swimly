"use client";

import { NativeSelect } from "./ui";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  FlaskConical,
  Headset,
  Moon,
  SlidersHorizontal,
  Sun,
  Waves,
} from "lucide-react";
import { APP_NAME, CLUBS } from "../lib/fixtures";
import { PREFIX } from "../lib/persistence";
import type { ClubId, NetworkMode } from "../lib/types";
import { useDemo } from "./provider";
import { Avatar, Button, Notice } from "./ui";

const NAV = [
  { href: "/reception", label: "Reception", icon: Headset },
  { href: "/today", label: "Poolside", icon: CalendarDays },
];
export function Shell({ children }: { children: ReactNode }) {
  const { store, state } = useDemo();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    try {
      const saved = localStorage.getItem(`${PREFIX}theme`);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* Follow the device if browser storage is unavailable. */
    }
    return "system";
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const device = window.matchMedia("(prefers-color-scheme: dark)");
    const syncDarkClass = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && device.matches),
      );
    syncDarkClass();
    device.addEventListener("change", syncDarkClass);
    try {
      localStorage.setItem(`${PREFIX}theme`, theme);
    } catch {
      /* OS theme still works without storage. */
    }
    return () => device.removeEventListener("change", syncDarkClass);
  }, [theme]);
  function toggleTheme() {
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setTheme(dark ? "light" : "dark");
  }
  const current = pathname.startsWith("/reception")
    ? "Reception"
    : pathname.startsWith("/class/")
      ? "Class workspace"
      : "Poolside";
  const currentClass =
    state.desk.classes.find((course) => pathname.endsWith(`/${course.id}`)) ??
    state.desk.classes.find((course) => course.clubId === state.clubId)!;
  const clubSelect = (
    <label className="club-picker">
      <span className="sr-only">Current club</span>
      <NativeSelect
        aria-label="Current club"
        value={state.clubId}
        onChange={(event) => {
          store.setClub(event.target.value as ClubId);
          if (pathname.startsWith("/class/")) router.push("/today");
        }}
      >
        {Object.entries(CLUBS).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="preview-bar" aria-label="Prototype preview">
        <span className="preview-label">
          <FlaskConical size={15} aria-hidden="true" />
          <strong>shadcn/ui preview</strong>
          <span className="preview-description">
            Fictional data · Tuesday 8 September, 15:20
          </span>
        </span>
        <Button
          variant="ghost"
          className="preview-toggle"
          onClick={() => setPreviewOpen(!previewOpen)}
          aria-expanded={previewOpen}
          aria-controls="preview-controls"
        >
          <SlidersHorizontal size={15} /> Preview controls
        </Button>
      </aside>
      {previewOpen && (
        <section
          id="preview-controls"
          className="preview-controls"
          aria-label="Simulation controls"
        >
          <label>
            Connection
            <NativeSelect
              aria-label="Connection"
              value={state.network}
              onChange={(event) =>
                store.setNetwork(event.target.value as NetworkMode)
              }
            >
              <option value="normal">Normal</option>
              <option value="slow">Slow saves</option>
              <option value="offline">Lost connection</option>
              <option value="failure">Save failure</option>
            </NativeSelect>
          </label>
          <label>
            Permissions
            <NativeSelect
              aria-label="Permissions"
              value={state.permissions.length ? "edit" : "read"}
              onChange={(event) =>
                store.setReadOnly(event.target.value === "read")
              }
            >
              <option value="edit">Can edit</option>
              <option value="read">Read only</option>
            </NativeSelect>
          </label>
          <label>
            Colour mode
            <NativeSelect
              aria-label="Colour mode"
              value={theme}
              onChange={(event) => setTheme(event.target.value as typeof theme)}
            >
              <option value="system">Follow device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </NativeSelect>
          </label>
          <Button
            variant="secondary"
            onClick={() => store.simulateConflict(currentClass)}
          >
            Simulate another edit
          </Button>
          <p>
            All saves use a separate fixture store in this browser. No real
            records are connected.
          </p>
        </section>
      )}
      <div className="app-frame">
        <aside className="sidebar">
          <Link
            href="/reception"
            className="wordmark"
            aria-label={`${APP_NAME} home`}
          >
            <span className="brand-symbol">
              <Waves size={25} strokeWidth={2.5} />
            </span>
            {APP_NAME}
            <span className="wordmark-dot" />
          </Link>
          <div className="sidebar-club">
            <span className="small muted">Your club</span>
            {clubSelect}
          </div>
          <nav aria-label="Main navigation">
            <span className="nav-group">Workspace</span>
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                className={`nav-link ${(href === "/reception" ? pathname.startsWith(href) : !pathname.startsWith("/reception")) ? "is-active" : ""}`}
                href={href}
                key={href}
                aria-current={
                  (
                    href === "/reception"
                      ? pathname.startsWith(href)
                      : !pathname.startsWith("/reception")
                  )
                    ? "page"
                    : undefined
                }
              >
                <Icon size={20} />
                {label}
                {label === "Poolside" && (
                  <span className="nav-count">
                    {
                      state.desk.classes.filter(
                        (course) => course.clubId === state.clubId,
                      ).length
                    }
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="staff-identity">
              <Avatar initials="AM" size="small" />
              <div>
                <strong>Alex Murphy</strong>
                <span className="small muted">Staff workspace</span>
              </div>
            </div>
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <div className="desktop-breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{current}</strong>
            </div>
            <Link
              href="/reception"
              className="mobile-brand"
              aria-label={`${APP_NAME} home`}
            >
              <Waves size={26} />
            </Link>
            <div className="topbar-tools">
              <div className="mobile-club">{clubSelect}</div>
              <span className="desktop-date">Tuesday, 8 September</span>
              <Button
                variant="ghost"
                className="icon-button theme-toggle"
                aria-label="Toggle colour mode"
                onClick={toggleTheme}
              >
                <Sun className="sun-icon" size={19} />
                <Moon className="moon-icon" size={19} />
              </Button>
              <span className="topbar-avatar">
                <Avatar initials="AM" size="small" />
              </span>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="page-content">
            {state.storageWarning && (
              <Notice tone="error">
                Browser storage is unavailable or unreadable. Keep this tab
                open; changes may not survive a reload.
              </Notice>
            )}
            {!state.permissions.length && (
              <Notice>
                You’re viewing this workspace without editing permissions.
              </Notice>
            )}
            {children}
          </main>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            className={
              (
                href === "/reception"
                  ? pathname.startsWith(href)
                  : !pathname.startsWith("/reception")
              )
                ? "is-active"
                : ""
            }
            href={href}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {state.notice && (
        <div className="toast" role="status">
          <Check size={20} />
          <span>{state.notice}</span>
        </div>
      )}
    </>
  );
}
