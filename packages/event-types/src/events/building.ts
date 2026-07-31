import { IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Building"
export const BuildingSelectedEvent = defineEvent(
  "building.selected",
  z.object({ buildingId: IdSchema }),
);

export const BuildingStateChangedEvent = defineEvent(
  "building.state_changed",
  z.object({
    buildingId: IdSchema,
    priorState: z.string().min(1),
    newState: z.string().min(1),
    reasonEventId: IdSchema,
  }),
);

export const BUILDING_EVENTS = [BuildingSelectedEvent, BuildingStateChangedEvent] as const;
