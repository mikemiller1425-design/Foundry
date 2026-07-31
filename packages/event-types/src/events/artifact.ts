import { ArtifactTypeSchema, IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Artifact"
export const ArtifactCreatedEvent = defineEvent(
  "artifact.created",
  z.object({
    artifactId: IdSchema,
    artifactType: ArtifactTypeSchema,
    name: z.string().min(1),
    checksumStatus: z.enum(["pending", "computed"]),
  }),
);

export const ArtifactValidatedEvent = defineEvent(
  "artifact.validated",
  z.object({ checksum: z.string().min(1), evidenceIds: z.array(IdSchema) }),
);

export const ArtifactReadyEvent = defineEvent("artifact.ready", z.object({}));

export const ARTIFACT_EVENTS = [
  ArtifactCreatedEvent,
  ArtifactValidatedEvent,
  ArtifactReadyEvent,
] as const;
