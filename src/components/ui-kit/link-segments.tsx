import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";
export function LinkSegments({
  label,
  value,
  options,
  size = "md",
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
  size?: "sm" | "md" | "lg";
}) {
  return (
    <nav
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-ui-lg bg-ui-muted p-1"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          asChild
          variant="ghost"
          size={size === "md" ? "default" : size}
          className={cn(value === option.value && "bg-ui-background shadow-sm")}
        >
          <Link
            href={option.href}
            scroll={false}
            aria-current={option.value === value ? "page" : undefined}
          >
            {option.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
