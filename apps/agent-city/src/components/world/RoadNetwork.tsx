"use client";

import { useMemo } from "react";
import { resolveRoadEndpoints } from "@/lib/world/roadNetwork";
import { Road } from "./Road";

// FBL-018 — the full permitted route graph (docs/02-specification/
// world-model.md → "Road network"): homes<->office, office<->warehouse,
// warehouse<->QA, QA<->dock. Purely static and non-interactive — no
// selection, no runtime state — since roads carry no dynamic
// available/highlighted/inactive signal until FBL-021 wires it to
// `transfer.*` events (this rung's own explicit scope boundary).
export function RoadNetwork() {
  const segments = useMemo(() => resolveRoadEndpoints(), []);

  return (
    <>
      {segments.map(({ segment, from, to }) => (
        <Road key={segment.id} from={from} to={to} />
      ))}
    </>
  );
}
