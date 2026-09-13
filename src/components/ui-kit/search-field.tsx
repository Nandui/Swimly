import { Search } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
export function SearchField({
  name = "q",
  label,
  placeholder,
  defaultValue = "",
  width,
}: {
  name?: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  width?: number;
}) {
  return (
    <div
      className="flex w-full items-center gap-2"
      style={{ maxWidth: width ? width + 96 : undefined }}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ui-muted-foreground"
        />
        <Input
          key={defaultValue}
          type="search"
          name={name}
          aria-label={label}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="pl-10"
        />
      </div>
      <Button type="submit" variant="outline">
        Search
      </Button>
    </div>
  );
}
