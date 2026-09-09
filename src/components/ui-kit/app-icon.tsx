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
import { Icon } from "@/components/workspace/misc";


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
