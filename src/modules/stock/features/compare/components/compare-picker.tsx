import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/shadcn/native-select";
import { Label } from "@/components/shadcn/label";
import { formatShortDay, plural } from "@/lib/format";

/** Which two counts to compare: a plain GET form, so the choice is in the address and can be shared. */
type Option = { id: string; site: string; stockDate: string; counted: number };

export function ComparePicker({ options, from, to }: { options: Option[]; from?: string; to?: string }) {
  const sites = [...new Set(options.map((o) => o.site))];
  const list = (id: string, name: string, label: string, value?: string) => (
    <div className="flex grow basis-(--pc-field-min) flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} name={name} defaultValue={value ?? ""} required className="min-h-11 w-full">
        <NativeSelectOption value="">Choose a count</NativeSelectOption>
        {sites.map((site) => (
          <NativeSelectOptGroup key={site} label={site}>
            {options.filter((o) => o.site === site).map((o) => (
              <NativeSelectOption key={o.id} value={o.id}>{site}, {formatShortDay(o.stockDate)} ({plural(o.counted, "product")})</NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>
    </div>
  );
  return (
    <form method="get" className="flex flex-wrap items-end gap-4">
      {list("stk-from", "from", "Earlier count", from)}
      {list("stk-to", "to", "Later count", to)}
      <Button type="submit" variant="outline" className="min-h-11">Compare</Button>
    </form>
  );
}
