"use client";

import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  KeyRound,
  Layers,
  Plus,
  ScrollText,
  Users,
  Waves,
} from "lucide-react";
import { Icon } from "@astryxdesign/core/Icon";

/** Astryx's Icon is a client component, so a server-rendered page cannot hand
 *  it an icon *component* — React refuses to send a function across. Server
 *  pages name the icon instead, and the lookup happens here, on the client.
 *  Client components keep using Astryx's Icon with the lucide component
 *  directly. */
const ICONS = {
  arrowRight: ArrowRight,
  building: Building2,
  calendarCheck: CalendarCheck,
  calendarDays: CalendarDays,
  calendarHeart: CalendarHeart,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clipboardCheck: ClipboardCheck,
  clipboardList: ClipboardList,
  keyRound: KeyRound,
  layers: Layers,
  plus: Plus,
  scrollText: ScrollText,
  users: Users,
  waves: Waves,
} as const;

export type AppIconName = keyof typeof ICONS;

type IconProps = React.ComponentProps<typeof Icon>;

export function AppIcon({
  name,
  ...rest
}: Omit<IconProps, "icon"> & { name: AppIconName }) {
  return <Icon icon={ICONS[name]} {...rest} />;
}
