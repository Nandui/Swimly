import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileBadge,
  GraduationCap,
  Hourglass,
  KeyRound,
  Layers,
  MonitorSmartphone,
  Plus,
  ReceiptText,
  ScrollText,
  SearchX,
  UserRoundSearch,
  Users,
  UsersRound,
  UserX,
  Waves,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  alert: AlertCircle,
  arrowRight: ArrowRight,
  award: Award,
  book: BookOpen,
  building: Building2,
  calendarCheck: CalendarCheck,
  calendarDays: CalendarDays,
  calendarHeart: CalendarHeart,
  calendarRange: CalendarRange,
  certificate: FileBadge,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clipboardCheck: ClipboardCheck,
  clipboardList: ClipboardList,
  graduation: GraduationCap,
  hourglass: Hourglass,
  keyRound: KeyRound,
  layers: Layers,
  monitor: MonitorSmartphone,
  plus: Plus,
  receipt: ReceiptText,
  scrollText: ScrollText,
  searchX: SearchX,
  userSearch: UserRoundSearch,
  userX: UserX,
  users: Users,
  usersRound: UsersRound,
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
