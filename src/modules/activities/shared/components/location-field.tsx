"use client";

import { useEffect, useState } from "react";
import { PlaceLanesField, type AreaWithLanes } from "@/components/ui/lane-picker";
import { workingSiteAreas } from "@/modules/activities/shared/areas";

/** Where a class or an assessment is: one of the working site's areas (kept in Admin, Areas), the
 *  lanes it takes in a pool with lanes (owner request, 19 October 2026), and an optional detail.
 *  Saved as one location, "Learner pool, lane 3", as before, so nothing that reads it changes, and
 *  the rota Plan shows the class in those lanes. A location from before the list stays as it was. */
export function LocationField({ id = "location", name = "location", defaultValue, label = "Where" }: {
  id?: string; name?: string; defaultValue?: string | null; label?: string;
}) {
  const [areas, setAreas] = useState<AreaWithLanes[] | null>(null);
  useEffect(() => {
    let live = true;
    workingSiteAreas().then((list) => { if (live) setAreas(list); }).catch(() => { if (live) setAreas([]); });
    return () => { live = false; };
  }, []);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <PlaceLanesField key={areas ? "ready" : "loading"} fid={id} name={name} areas={areas} defaultValue={defaultValue} label={label} detail />
    </div>
  );
}
