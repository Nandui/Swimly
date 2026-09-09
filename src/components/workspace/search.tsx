"use client";
import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { NativeSelect } from "@/components/primitives/native-select";
import { Field } from "./fields";
import { cn } from "@/lib/utils";
export type Option = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};
type Group = { type: "section"; title: string; options: Option[] };
type SelectorProps = {
  id?: string;
  label: string;
  description?: string;
  isLabelHidden?: boolean;
  options: (Option | Group)[];
  value?: string | null;
  onChange: (value: string) => void;
  htmlName?: string;
  placeholder?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  className?: string;
  width?: "100%";
  hasSearch?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  emptySearchText?: string;
  hasClear?: boolean;
  variant?: "ghost";
  size?: "md";
  renderValue?: (option: Option) => React.ReactNode;
  renderOption?: (option: Option) => React.ReactNode;
};
export function Selector({
  id,
  label,
  description,
  isLabelHidden,
  options,
  value,
  onChange,
  htmlName,
  placeholder,
  isRequired,
  isDisabled,
  className,
  width,
  hasSearch,
  searchPlaceholder,
  emptyText,
  emptySearchText,
  hasClear,
  renderValue,
  renderOption,
}: SelectorProps) {
  const generated = React.useId();
  const inputId = id ?? generated;
  const flat = options.flatMap((item) =>
    "options" in item ? item.options : [item],
  );
  const selected = flat.find((item) => item.value === value) ?? null;
  if (!hasSearch)
    return (
      <Field
        label={label}
        inputID={inputId}
        description={description}
        isLabelHidden={isLabelHidden}
        className={className}
      >
        <NativeSelect
          id={inputId}
          name={htmlName}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={isRequired}
          disabled={isDisabled}
          aria-describedby={description ? `${inputId}-hint` : undefined}
          className="w-full"
        >
          <option value="">{placeholder ?? "Choose…"}</option>
          {options.map((item) =>
            "options" in item ? (
              <optgroup key={item.title} label={item.title}>
                {item.options.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option
                key={item.value}
                value={item.value}
                disabled={item.disabled}
              >
                {item.label}
              </option>
            ),
          )}
        </NativeSelect>
      </Field>
    );
  return (
    <Field
      label={label}
      inputID={inputId}
      description={description}
      isLabelHidden={isLabelHidden}
      className={className}
    >
      <Combobox.Root<Option>
        items={flat}
        value={selected}
        onValueChange={(item) => onChange(item?.value ?? "")}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        isItemEqualToValue={(a, b) => a.value === b.value}
        name={htmlName}
        disabled={isDisabled}
        required={isRequired}
      >
        <div className={cn("flex", width && "w-full")}>
          <Combobox.Trigger
            id={inputId}
            aria-label={label}
            className="workspace-picker-trigger"
          >
            <span className="min-w-0 truncate flex-1 text-left">
              {selected
                ? (renderValue?.(selected) ?? selected.label)
                : (placeholder ?? "Choose…")}
            </span>
            <ChevronDown className="size-4" />
          </Combobox.Trigger>
          {hasClear && selected && (
            <button
              type="button"
              aria-label={`Clear ${label}`}
              onClick={() => onChange("")}
              className="size-11 shrink-0 grid place-items-center"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Combobox.Portal>
          <Combobox.Positioner className="z-70" sideOffset={8}>
            <Combobox.Popup className="workspace-picker-popup">
              <Combobox.Input
                aria-label={searchPlaceholder ?? `Search ${label}`}
                placeholder={searchPlaceholder ?? "Search…"}
                className="workspace-picker-search"
              />
              <Combobox.Empty className="px-3 py-4 text-sm text-muted-foreground">
                {emptySearchText ?? emptyText ?? "No matches."}
              </Combobox.Empty>
              <Combobox.List>
                {(item: Option) => (
                  <Combobox.Item
                    key={item.value}
                    value={item}
                    disabled={item.disabled}
                    className="workspace-menu-item"
                  >
                    <span className="min-w-0 flex-1">
                      {renderOption?.(item) ?? (
                        <>
                          <span>{item.label}</span>
                          {item.description && (
                            <span className="block text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    <Combobox.ItemIndicator>
                      <Check className="size-4" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </Field>
  );
}
export type SearchableItem<Data> = {
  id: string;
  label: string;
  auxiliaryData?: Data;
};
export type SearchSource<Item> = {
  search: (query: string) => Promise<Item[]>;
  bootstrap: () => Item[];
};
export function Typeahead<T extends { id: string; label: string }>({
  id,
  label,
  isLabelHidden,
  description,
  searchSource,
  value,
  onChange,
  onChangeQuery,
  status,
  placeholder,
  emptySearchResultsText,
  debounceMs = 200,
  maxMenuItems = 20,
  renderItem,
}: {
  id?: string;
  label: string;
  isLabelHidden?: boolean;
  description?: string;
  searchSource: SearchSource<T>;
  value: T | null;
  onChange: (value: T | null) => void;
  onChangeQuery?: (query: string) => void;
  status?: { type: "error"; message: string };
  statusVariant?: "detached";
  placeholder?: string;
  emptySearchResultsText?: string;
  debounceMs?: number;
  maxMenuItems?: number;
  renderItem: (item: T) => React.ReactNode;
  width?: "100%";
}) {
  const generated = React.useId();
  const inputId = id ?? generated;
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const generation = React.useRef(0);
  React.useEffect(() => {
    let active = true;
    const current = ++generation.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const next = query.trim()
          ? await searchSource.search(query)
          : searchSource.bootstrap();
        if (active && current === generation.current)
          setItems(next.slice(0, maxMenuItems));
      } finally {
        if (active && current === generation.current) setLoading(false);
      }
    }, debounceMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, searchSource, debounceMs, maxMenuItems]);
  return (
    <Field
      label={label}
      inputID={inputId}
      isLabelHidden={isLabelHidden}
      description={description}
    >
      <Combobox.Root<T>
        items={items}
        filter={null}
        value={value}
        onValueChange={onChange}
        onInputValueChange={(next) => {
          setQuery(next);
          onChangeQuery?.(next);
        }}
        itemToStringLabel={(item) => item.label}
        isItemEqualToValue={(a, b) => a.id === b.id}
      >
        <div className="relative">
          <Search
            className="absolute left-3 top-3.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Combobox.Input
            id={inputId}
            placeholder={placeholder}
            aria-describedby={description ? `${inputId}-hint` : undefined}
            className="workspace-search-input"
          />
          <Combobox.Clear
            aria-label="Clear swimmer search"
            className="absolute right-0 top-0 size-11 grid place-items-center"
          >
            <X className="size-4" />
          </Combobox.Clear>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner className="z-70" sideOffset={8}>
            <Combobox.Popup className="workspace-picker-popup">
              <Combobox.Empty className="px-3 py-4 text-sm text-muted-foreground">
                {loading
                  ? "Searching…"
                  : query.trim()
                    ? emptySearchResultsText
                    : "Type a name or member number to search."}
              </Combobox.Empty>
              <Combobox.List>
                {(item: T) => (
                  <Combobox.Item
                    key={item.id}
                    value={item}
                    className="workspace-menu-item"
                  >
                    {renderItem(item)}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {status && (
        <p role="alert" className="text-danger-ink text-sm mt-2">
          {status.message}
        </p>
      )}
    </Field>
  );
}
export function TypeaheadItem({
  item,
  description,
}: {
  item: { label: string };
  description?: React.ReactNode;
}) {
  return (
    <span>
      <span className="block font-medium">{item.label}</span>
      {description && (
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      )}
    </span>
  );
}
