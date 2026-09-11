"use client";

import * as React from "react";
import Form from "next/form";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { SearchField } from "@/components/ui-kit/search-field";
import type { FilterDimension } from "@/lib/courses/filters";
import { classBrowserHref } from "@/lib/courses/browse";

/** Filters live in the URL. Option counts account for all other filters;
 * changing one resets pagination without losing the search. */
export function CourseFilters({ dimensions, q, active, showing, total, state, todayDay }: {
  dimensions: FilterDimension[];
  q: string;
  active: number;
  showing: number;
  total: number;
  state: "active" | "archived";
  todayDay: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [refreshing, startRefresh] = React.useTransition();
  const href = (changes: Record<string, string | null>) =>
    classBrowserHref(Object.fromEntries(params), { ...changes, page: null });

  return (
    <VStack gap={3}>
      <Form action="/courses" role="search" aria-label="Search weekly classes" className="w-full">
        {dimensions.map(d => d.selected ? <input key={d.key} type="hidden" name={d.key} value={d.selected} /> : null)}
        {state === "archived" ? <input type="hidden" name="state" value="archived" /> : null}
        <SearchField label="Search classes" placeholder="Search by class, level, pool area or instructor" defaultValue={q} />
      </Form>
      <HStack gap={2} vAlign="center" wrap="wrap">
        {dimensions.map(d => <FilterPicker key={d.key} dimension={d} onPick={value => router.push(href({ [d.key]: value }), { scroll: false })} />)}
        {active > 0 ? <Button label="Reset filters" variant="ghost" onClick={() => router.push(state === "archived" ? "/courses?state=archived" : "/courses", { scroll: false })} /> : null}
      </HStack>
      <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
        <Text color="secondary" role="status">{showing} of {total} {state === "archived" ? "archived " : ""}classes{active ? " match" : " across the week"}</Text>
        <HStack gap={2}>
          <Button label="Today only" variant="ghost" onClick={() => router.push(href({ day: todayDay }), { scroll: false })} />
          <Button label="Refresh" variant="ghost" isLoading={refreshing} onClick={() => startRefresh(() => router.refresh())} />
        </HStack>
      </HStack>
    </VStack>
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
      searchPlaceholder={`Search ${dimension.label.toLowerCase()}…`}
      emptySearchText="Nothing matches."
      placeholder={dimension.label}
      options={dimension.options.map((option) => ({ value: option.value, label: option.label }))}
      // The clear × only once something is set; before that the chevron is
      // the whole affordance.
      {...(dimension.selected
        ? {
            hasClear: true as const,
            value: dimension.selected,
            onChange: (value: string | null) => onPick(value),
          }
        : { value: undefined, onChange: (value: string) => onPick(value) })}
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
        <HStack gap={3} vAlign="center" width="100%">
          <StackItem size="fill">
            <Text maxLines={1} hasTruncateTooltip={false}>
              {option.label ?? option.value}
            </Text>
          </StackItem>
          <Text type="supporting" hasTabularNumbers>
            {countOf.get(option.value) ?? ""}
          </Text>
        </HStack>
      )}
    />
  );
}
