import { LIGHTHOUSE_STATE_VISUALS } from "@foundry/world-model";
import { describe, expect, it } from "vitest";
import { CONSTRUCTION_SITE_VISUALS } from "./constructionSitePhase";
import { OPERATIONAL_BUILDING_VISUALS } from "./operationalBuildingVisuals";
import { RESIDENCE_VISUALS } from "./residenceVisuals";
import { VEHICLE_VISUALS } from "./vehicleVisuals";
import { AGENT_VISUALS } from "./agentVisuals";
import { CARGO_VISUALS } from "./cargoVisuals";

/**
 * FBL-033 — "color not sole signal" (`v1-acceptance.md` → Accessibility).
 *
 * The requirement is easy to satisfy by accident and easy to lose by
 * accident: a new state gets a colour because colour is how the 3D world
 * shows things, and the textual equivalent is added later or not at all.
 * So the property is asserted structurally over the whole visual
 * vocabulary rather than spot-checked per component.
 *
 * Two distinct failures are checked, because they break differently:
 *
 * - A state with **no** label is invisible to anyone not perceiving
 *   colour.
 * - Two states sharing a label are *worse* than no label: the text
 *   actively asserts they are the same thing when the colour says they
 *   differ, so a reader is misinformed rather than merely uninformed.
 */

const VISUAL_VOCABULARIES: Record<string, Record<string, { label: string; color?: string }>> = {
  "operational buildings": OPERATIONAL_BUILDING_VISUALS,
  residences: RESIDENCE_VISUALS,
  vehicle: VEHICLE_VISUALS,
  agents: AGENT_VISUALS,
  cargo: CARGO_VISUALS,
  "construction site": CONSTRUCTION_SITE_VISUALS,
};

describe("FBL-033 — no operational state is distinguishable by colour alone", () => {
  for (const [name, vocabulary] of Object.entries(VISUAL_VOCABULARIES)) {
    describe(name, () => {
      it("gives every state a non-empty textual label", () => {
        for (const [state, spec] of Object.entries(vocabulary)) {
          expect(spec.label, `${name} → ${state}`).toBeTruthy();
          expect(spec.label.trim().length, `${name} → ${state}`).toBeGreaterThan(0);
        }
      });

      it("gives no two states the same label", () => {
        const labels = Object.values(vocabulary).map((spec) => spec.label.trim().toLowerCase());
        expect(new Set(labels).size).toBe(labels.length);
      });

      it("does not encode meaning in the colour that the label omits", () => {
        // Every state that has a distinct colour must also have a
        // distinct label — otherwise the colour carries information the
        // text does not.
        const byColor = new Map<string, string[]>();
        for (const [state, spec] of Object.entries(vocabulary)) {
          if (!spec.color) continue;
          byColor.set(spec.color, [...(byColor.get(spec.color) ?? []), state]);
        }
        const distinctColors = byColor.size;
        const distinctLabels = new Set(
          Object.values(vocabulary).map((spec) => spec.label.trim().toLowerCase()),
        ).size;
        expect(distinctLabels).toBeGreaterThanOrEqual(distinctColors);
      });
    });
  }

  it("the Lighthouse — the governance signal — labels every state", () => {
    for (const [state, label] of Object.entries(LIGHTHOUSE_STATE_VISUALS)) {
      expect(label, `lighthouse → ${state}`).toBeTruthy();
      expect(String(label).trim().length).toBeGreaterThan(0);
    }
    const labels = Object.values(LIGHTHOUSE_STATE_VISUALS).map((l) =>
      String(l).trim().toLowerCase(),
    );
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("distinguishes a validation rejection from an ordinary block in text, not only in colour", () => {
    // FBL-029 made these different colours (red vs orange). If their
    // labels were identical, a reader relying on text would be told the
    // two situations are the same — which is exactly the failure this
    // acceptance line exists to prevent.
    expect(OPERATIONAL_BUILDING_VISUALS.failed.label).not.toBe(
      OPERATIONAL_BUILDING_VISUALS.blocked.label,
    );
    expect(OPERATIONAL_BUILDING_VISUALS.failed.color).not.toBe(
      OPERATIONAL_BUILDING_VISUALS.blocked.color,
    );
  });
});
