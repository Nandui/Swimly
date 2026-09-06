"use client";

import * as React from "react";
import { Typeahead, TypeaheadItem } from "@astryxdesign/core/Typeahead";
import type { SearchSource, SearchableItem } from "@astryxdesign/core/Typeahead";
import { searchStudents, type StudentHit } from "@/lib/students/actions/search";
import { ageLabel, fullName } from "@/lib/students/constants";

/** How long to wait after the last keystroke before asking. Long enough that a
 *  typed surname is one request rather than seven, short enough that it never
 *  reads as lag. */
const DEBOUNCE_MS = 200;

type Item = SearchableItem<StudentHit>;

function toItem(hit: StudentHit): Item {
  return { id: hit.id, label: fullName(hit), auxiliaryData: hit };
}

/** Finding one swimmer among a thousand, without being sent the thousand.
 *
 *  The searchable pickers elsewhere take their options as props and filter
 *  them in the browser. That is right for classes — there are 134 — and
 *  wrong for swimmers, where it meant every page with the picker on it carried
 *  the whole roll. This one asks the server for the twenty that match what has
 *  been typed so far, and nothing else ever crosses the wire. Astryx's
 *  Typeahead does the debouncing and drops a stale answer that lands after a
 *  newer question. */
export function StudentSearch({
  onSelect,
  selected = null,
  exclude = [],
  label = "Swimmer",
  labelHidden = false,
  description,
  placeholder = "Search by name or member number…",
  emptyText = "Nobody by that name.",
  id,
}: {
  onSelect: (hit: StudentHit | null) => void;
  /** The chosen swimmer, if the field holds one. */
  selected?: StudentHit | null;
  /** Swimmers not to offer — the ones already in the group, say. */
  exclude?: string[];
  label?: string;
  labelHidden?: boolean;
  description?: string;
  placeholder?: string;
  emptyText?: string;
  id?: string;
}) {
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const searchGeneration = React.useRef(0);
  const excludeKey = exclude.join(",");
  const source = React.useMemo<SearchSource<Item>>(
    () => ({
      async search(query) {
        const generation = ++searchGeneration.current;
        const term = query.trim();
        if (!term) return [];
        try {
          const found = await searchStudents(term, excludeKey ? excludeKey.split(",") : []);
          if (generation === searchGeneration.current) setSearchError(null);
          return found.map(toItem);
        } catch {
          if (generation === searchGeneration.current) setSearchError("Could not search swimmers. Check your connection and try again.");
          return [];
        }
      },
      bootstrap: () => [],
    }),
    [excludeKey]
  );

  return (
    <Typeahead<Item>
      id={id}
      label={label}
      isLabelHidden={labelHidden}
      description={description}
      searchSource={source}
      value={selected ? toItem(selected) : null}
      onChange={(item) => onSelect(item?.auxiliaryData ?? null)}
      onChangeQuery={() => { searchGeneration.current++; setSearchError(null); }}
      status={searchError ? { type: "error", message: searchError } : undefined}
      statusVariant="detached"
      placeholder={placeholder}
      emptySearchResultsText={emptyText}
      debounceMs={DEBOUNCE_MS}
      maxMenuItems={20}
      renderItem={(item) => (
        <TypeaheadItem
          item={item}
          description={
            item.auxiliaryData
              ? `${ageLabel(item.auxiliaryData.dateOfBirth)}${
                  item.auxiliaryData.memberNumber ? ` · ${item.auxiliaryData.memberNumber}` : ""
                }`
              : undefined
          }
        />
      )}
      width="100%"
    />
  );
}

/** The search as a form field. Posts the chosen id through a hidden input, so
 *  it sits inside the same plain `<form>` as every other field, exactly as
 *  `SearchablePicker` does. */
export function StudentPicker({
  name,
  id,
  label,
  description,
  placeholder = "Search by name or member number…",
}: {
  name: string;
  id?: string;
  /** Usually injected by the form's Field wrapper. */
  label?: string;
  description?: string;
  placeholder?: string;
}) {
  const [chosen, setChosen] = React.useState<StudentHit | null>(null);

  return (
    <>
      <input type="hidden" name={name} value={chosen?.id ?? ""} />
      <StudentSearch
        id={id}
        label={label ?? "Swimmer"}
        labelHidden={label === undefined}
        description={description}
        selected={chosen}
        onSelect={setChosen}
        placeholder={placeholder}
      />
    </>
  );
}
