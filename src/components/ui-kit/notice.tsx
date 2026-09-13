import type { ReactNode } from "react";
import { AlertCircle, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";

const NOTICE = { error: AlertCircle, warning: TriangleAlert, info: Info };
export function Notice({
  tone = "info",
  title,
  description,
  actions,
  children,
}: {
  tone?: keyof typeof NOTICE;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const Icon = NOTICE[tone];
  return (
    <Alert variant={tone === "error" ? "destructive" : "default"}>
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
