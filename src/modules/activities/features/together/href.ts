/** Together's address: the group in the order it was built, then any what-if levels
 *  (`as=student:level,…`). Kept in the address so a what-if can be shared, refreshed or undone
 *  with Back, and so nothing about it is ever saved. */
export type WhatIf = Record<string, string>;

export function togetherHref(ids: string[], whatIf: WhatIf = {}): string {
  if (!ids.length) return "/together";
  const as = ids.filter((id) => whatIf[id]).map((id) => `${id}:${whatIf[id]}`);
  return `/together?students=${ids.join(",")}${as.length ? `&as=${as.join(",")}` : ""}`;
}

/** Only swimmers in the group, at levels that can be searched; anything else is dropped. */
export function readWhatIf(raw: string, ids: string[], levelIds: Set<string>): WhatIf {
  const whatIf: WhatIf = {};
  for (const pair of raw.split(",")) {
    const [id, levelId] = pair.split(":");
    if (id && levelId && ids.includes(id) && levelIds.has(levelId)) whatIf[id] = levelId;
  }
  return whatIf;
}
