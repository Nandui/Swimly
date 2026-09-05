import { Heading, Text } from "@astryxdesign/core/Text";
import { cn } from "@/lib/utils";

/** The page's opening: one H1, a quiet description line, actions right. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <Heading level={1}>{title}</Heading>
        {description ? (
          <Text as="p" type="body" color="secondary" display="block" className="mt-1 max-w-prose">
            {description}
          </Text>
        ) : null}
      </div>
      {/* Wraps: a course page carries five actions, which is wider than a
          phone. Below the tablet breakpoint the row takes the full width and
          the buttons flow onto a second line rather than off the screen. */}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 pt-1 max-md:w-full md:shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
