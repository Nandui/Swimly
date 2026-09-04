import { TabStrip } from "@/components/ui-kit/tab-strip";

/** The sections of a swimmer's profile. The strip itself is the shared one;
 *  this knows the names and where they point. */

export const PROFILE_TABS = ["classes", "progress", "attendance", "assessments"] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export function profileTab(value: string | string[] | undefined): ProfileTab {
  const wanted = Array.isArray(value) ? value[0] : value;
  return (PROFILE_TABS as readonly string[]).includes(wanted ?? "")
    ? (wanted as ProfileTab)
    : "classes";
}

export type ProfileTabItem = {
  key: ProfileTab;
  label: string;
  /** Null for a section that is not a list. */
  count: number | null;
};

export function ProfileTabs({
  studentId,
  active,
  items,
}: {
  studentId: string;
  active: ProfileTab;
  items: ProfileTabItem[];
}) {
  return (
    <TabStrip
      ariaLabel="Sections of this profile"
      items={items.map((item) => ({
        key: item.key,
        href: `/students/${studentId}?tab=${item.key}`,
        label: item.label,
        count: item.count,
        active: item.key === active,
      }))}
    />
  );
}
