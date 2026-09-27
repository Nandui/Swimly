import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Hourglass,
  KeyRound,
  Layers,
  MonitorSmartphone,
  Plus,
  ScrollText,
  Users,
  Waves,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  arrowRight: ArrowRight,
  bookOpen: BookOpen,
  building: Building2,
  calendarCheck: CalendarCheck,
  calendarDays: CalendarDays,
  calendarHeart: CalendarHeart,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clipboardCheck: ClipboardCheck,
  clipboardList: ClipboardList,
  graduationCap: GraduationCap,
  hourglass: Hourglass,
  keyRound: KeyRound,
  layers: Layers,
  monitor: MonitorSmartphone,
  plus: Plus,
  scrollText: ScrollText,
  users: Users,
  waves: Waves,
};
export type AppIconName = keyof typeof ICONS;
const SIZES = { sm: "size-4", md: "size-5", lg: "size-8" };
export function AppIcon({
  name,
  size = "md",
  color,
  className,
  ...props
}: Omit<LucideProps, "size" | "color"> & {
  name: AppIconName;
  size?: keyof typeof SIZES;
  color?: "primary" | "secondary";
}) {
  const Icon = ICONS[name];
  return (
    <Icon
      aria-hidden="true"
      {...props}
      className={cn(
        "shrink-0",
        SIZES[size],
        color === "secondary" && "text-ui-muted-foreground",
        className,
      )}
    />
  );
}
