import type { ReactNode } from "react";
import {
  AlertCircle,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";

/** The only notice in Turnfin: each tone has its colour (poolside.css) and an icon. */
const NOTICE_ICON = {
  info: Info,
  warning: TriangleAlert,
  error: AlertCircle,
  success: CircleCheck,
} satisfies Record<string, LucideIcon>;

export type NoticeTone = keyof typeof NOTICE_ICON;

export function Notice({
  tone = "info",
  icon,
  live,
  title,
  description,
  actions,
  children,
  className,
}: {
  tone?: NoticeTone;
  /** A context icon (lock, phone, eye) in place of the tone's own. */
  icon?: LucideIcon;
  /**
   * "alert" only for an error caused by the person's own action; "status" for the result of
   * async work. Static notices (banners, load errors) announce nothing.
   */
  live?: "alert" | "status";
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** Outer spacing only. */
  className?: string;
}) {
  const Icon = icon ?? NOTICE_ICON[tone];
  return (
    <Alert tone={tone} role={live} className={className}>
      <Icon aria-hidden="true" />
      <AlertTitle className="min-w-0 line-clamp-none break-words">
        {title}
      </AlertTitle>
      {description || children || actions ? (
        <AlertDescription className="min-w-0 break-words">
          {description}
          {children}
          {actions ? <div className="mt-3">{actions}</div> : null}
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
