"use client";

import * as React from "react";
import Form from "next/form";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ANY_DAY, type FilterDimension } from "@/lib/courses/filters";

/** The timetable's filter bar. Six dimensions, and they combine: a class has to
 *  satisfy every one that is set.
 *
 *  The Collapse-Not-Scroll rule applied to a filter bar. Day has seven values
 *  and could be tabs; time has fifteen and level has nine, and both grow every
 *  time the club adds a slot. Rather than one dimension in tabs and the rest
 *  hidden somewhere else, every dimension is the same searchable picker — so
 *  the bar's width is fixed no matter how the timetable grows, and the place to
 *  compare options is the list, where the counts line up in a column.
 *
 *  Counts on the options exclude that option's own dimension, so they read as
 *  "how many if I picked this instead" rather than "how many are already
 *  showing". Picking a value never lands you on an empty page.
 *
 *  The state lives in the URL, which is what makes a filtered timetable
 *  something you can send to somebody. */
export function CourseFilters({
  dimensions,
  q,
  active,
  showing,
  total,
}: {
  dimensions: FilterDimension[];
  q: string;
  active: number;
  showing: number;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(q);

  const href = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        // Clearing Day means the week, and the week is a value rather than an
        // absence — an absent `day` opens on today. Every other dimension
        // clears by disappearing.
        else if (key === "day") next.set(key, ANY_DAY);
        else next.delete(key);
      }
      // A key whose value is empty filters nothing, so it has no business in a
      // link somebody might send on.
      for (const [key, value] of [...next.entries()]) if (!value) next.delete(key);
      const query = next.toString();
      return query ? `/courses?${query}` : "/courses";
    },
    [params]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Full width on a phone, where a search box beside six pickers wraps
            into a ragged bar; its own width from the tablet up. */}
        <Form action="/courses" className="max-sm:w-full">
          {dimensions.map((d) =>
            d.selected ? (
              <input key={d.key} type="hidden" name={d.key} value={d.selected} />
            ) : d.key === "day" ? (
              // A search submitted from the week view has to stay on the week
              // view; without this the form would drop `day` and land on today.
              <input key={d.key} type="hidden" name="day" value={ANY_DAY} />
            ) : null
          )}
          <TextInput
            label="Search classes"
            isLabelHidden
            htmlName="q"
            value={query}
            onChange={setQuery}
            placeholder="Search classes…"
            startIcon={Search}
            hasClear
            size="md"
            className="max-sm:w-full sm:w-56"
          />
          {/* A form with one text field and no button submits on Enter by
              implicit submission, which is a rule with enough edge cases that
              a search box should not be the thing betting on it. This costs
              nothing and gives keyboard users something to tab to. */}
          <button type="submit" className="sr-only">
            Search
          </button>
        </Form>

        {dimensions.map((d) => (
          <FilterPicker
            key={d.key}
            dimension={d}
            onPick={(value) => router.push(href({ [d.key]: value }))}
          />
        ))}

        {active > 0 ? (
          <Button
            label={`Clear ${active === 1 ? "filter" : `all ${active}`}`}
            variant="ghost"
            size="md"
            onClick={() => router.push(`/courses?day=${ANY_DAY}`)}
          />
        ) : null}
      </div>

      {active > 0 ? (
        <Text as="p" type="supporting" display="block" role="status">
          <Text type="supporting" weight="medium" color="primary" hasTabularNumbers>
            {showing}
          </Text>{" "}
          of <Text type="supporting" hasTabularNumbers>{total}</Text> classes match.
        </Text>
      ) : null}
    </div>
  );
}

/** One dimension: a ghost selector reading "Day" until something is picked,
 *  then "Day: Monday" with a clear ×. The list is searchable and each option
 *  carries its count. */
function FilterPicker({
  dimension,
  onPick,
}: {
  dimension: FilterDimension;
  onPick: (value: string | null) => void;
}) {
  const labelOf = new Map(dimension.options.map((option) => [option.value, option.label]));
  const countOf = new Map(dimension.options.map((option) => [option.value, option.count]));

  return (
    <Selector
      label={`Filter by ${dimension.label}`}
      isLabelHidden
      variant="ghost"
      size="md"
      hasSearch
      hasClear
      searchPlaceholder={`Search ${dimension.label.toLowerCase()}…`}
      emptySearchText="Nothing matches."
      placeholder={dimension.label}
      options={dimension.options.map((option) => ({ value: option.value, label: option.label }))}
      value={dimension.selected ?? null}
      onChange={(value) => onPick(value)}
      renderValue={(option) => (
        <>
          <Text type="inherit" color="secondary">
            {dimension.label}:{" "}
          </Text>
          <Text type="inherit" weight="medium">
            {labelOf.get(option.value) ?? option.label ?? option.value}
          </Text>
        </>
      )}
      renderOption={(option) => (
        <span className="flex w-full items-center gap-3">
          <span className="min-w-0 flex-1 truncate">{option.label ?? option.value}</span>
          <Text type="supporting" hasTabularNumbers>
            {countOf.get(option.value) ?? ""}
          </Text>
        </span>
      )}
    />
  );
}
