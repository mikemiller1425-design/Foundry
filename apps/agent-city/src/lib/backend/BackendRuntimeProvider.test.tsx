import type { WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { StageAgentPanel } from "@/components/controls/StageAgentPanel";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackendRuntimeProvider } from "./BackendRuntimeProvider";
import { useRuntime } from "@/lib/mock-runtime";

/**
 * AC-103 regression, at the level the defect was reported.
 *
 * Reproduces the whole reported symptom rather than a unit of it: a
 * successful `POST /objectives` returns a real project and build, the two
 * events arrive, and "Current build" must stop saying "No build yet."
 * Before the fix the world-state projection was never refreshed after page
 * load, so this panel and the timeline disagreed indefinitely.
 */

const OBJECTIVE = "Add a JSON task store module with a test suite";
const BASE_URL = "http://api.test";

const EMPTY_WORLD: WorldState = {
  buildings: [],
  agents: [],
  currentBuild: null,
  activeTransfers: [],
  approvals: [],
  inventoryCounts: {},
  health: { status: "healthy", reasons: ["nominal"] },
  lastProcessedEventId: null,
};

const WORLD_WITH_BUILD: WorldState = {
  ...EMPTY_WORLD,
  currentBuild: {
    id: "build-1",
    projectId: "project-1",
    sequenceNumber: 1,
    status: "planned",
    objectiveSnapshot: OBJECTIVE,
    currentStageId: null,
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  },
};

function submissionEvents(): FoundryEvent[] {
  return [
    {
      id: "evt-1",
      type: "operator.objective_submitted",
      occurredAt: "2026-08-03T00:00:00.000Z",
      actorType: "operator",
      actorId: "operator-1",
      entityType: "Project",
      entityId: "project-1",
      correlationId: "project-1",
      severity: "info",
      schemaVersion: 1,
      payload: { objective: OBJECTIVE, projectId: "project-1" },
    },
    {
      id: "evt-2",
      type: "build.created",
      occurredAt: "2026-08-03T00:00:01.000Z",
      actorType: "operator",
      actorId: "operator-1",
      entityType: "Build",
      entityId: "build-1",
      correlationId: "build-1",
      severity: "info",
      schemaVersion: 1,
      payload: { projectId: "project-1", buildId: "build-1", objective: OBJECTIVE },
    },
  ] as FoundryEvent[];
}

/** The server this test stands in for; flips to "has a build" once POSTed. */
let world: WorldState;
let log: FoundryEvent[];
let objectivePosts: unknown[];
let worldStateReads: number;
let sources: FakeEventSource[];
/** Bodies POSTed to /commands, for the AC-106 checks. */
let commandPosts: unknown[];
/** The live context, captured by the AC-106 probe component. */
let probe: ReturnType<typeof useRuntime> | null = null;

class FakeEventSource {
  onerror: ((this: unknown, ev: unknown) => unknown) | null = null;
  onopen: ((this: unknown, ev: unknown) => unknown) | null = null;
  private listeners: ((event: MessageEvent) => void)[] = [];

  constructor(public readonly url: string) {
    sources.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === "foundry-event") this.listeners.push(listener);
  }

  close(): void {}

  open(): void {
    this.onopen?.call(this, {});
  }

  deliver(event: FoundryEvent): void {
    for (const listener of this.listeners) {
      listener({ data: JSON.stringify(event) } as MessageEvent);
    }
  }
}

beforeEach(() => {
  world = EMPTY_WORLD;
  log = [];
  objectivePosts = [];
  worldStateReads = 0;
  sources = [];
  commandPosts = [];
  probe = null;

  vi.stubGlobal(
    "EventSource",
    class {
      constructor(url: string) {
        return new FakeEventSource(url) as unknown as EventSource;
      }
    },
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/commands")) {
        commandPosts.push(JSON.parse(String(init?.body ?? "{}")));
        return {
          ok: true,
          status: 200,
          json: async () => ({ accepted: true }),
        } as Response;
      }
      if (url.endsWith("/world-state")) {
        worldStateReads += 1;
        const body = world;
        return { ok: true, status: 200, json: async () => body } as Response;
      }
      if (url.endsWith("/objectives")) {
        objectivePosts.push(url);
        // The backend commits both events and projects the new build
        // before it answers, exactly as the real service does.
        world = WORLD_WITH_BUILD;
        log = submissionEvents();
        return {
          ok: true,
          status: 201,
          json: async () => ({
            accepted: true,
            projectId: "project-1",
            buildId: "build-1",
            objective: OBJECTIVE,
          }),
        } as Response;
      }
      if (url.includes("/events")) {
        const body = log;
        return { ok: true, status: 200, json: async () => body } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Exposes the context's submitObjective to the test body. */
let submit: (() => Promise<unknown>) | null = null;

function Harness() {
  const { submitObjective } = useRuntime();
  submit = submitObjective
    ? () => submitObjective({ objective: OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" })
    : null;
  return <StageAgentPanel selection={null} onSelect={() => {}} />;
}

function renderProvider() {
  return render(
    <BackendRuntimeProvider baseUrl={BASE_URL}>
      <Harness />
    </BackendRuntimeProvider>,
  );
}

describe("BackendRuntimeProvider — a successful submission updates the world (AC-103)", () => {
  it("replaces 'No build yet.' with the submitted objective after POST /objectives", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByText("No build yet.")).toBeInTheDocument());
    await act(async () => sources[0]?.open());

    await act(async () => {
      await submit?.();
    });

    await waitFor(() => expect(screen.getByText(new RegExp(OBJECTIVE))).toBeInTheDocument());
    expect(screen.queryByText("No build yet.")).not.toBeInTheDocument();
  });

  it("refetches the authoritative world state rather than inventing one locally", async () => {
    renderProvider();
    await waitFor(() => expect(worldStateReads).toBeGreaterThan(0));
    await act(async () => sources[0]?.open());
    const readsBeforeSubmit = worldStateReads;

    await act(async () => {
      await submit?.();
    });

    expect(worldStateReads).toBeGreaterThan(readsBeforeSubmit);
    expect(objectivePosts).toHaveLength(1);
  });

  it("posts the objective exactly once", async () => {
    renderProvider();
    await waitFor(() => expect(worldStateReads).toBeGreaterThan(0));
    await act(async () => sources[0]?.open());

    await act(async () => {
      await submit?.();
    });

    expect(objectivePosts).toHaveLength(1);
  });

  it("does not post at all while disconnected, and says so", async () => {
    renderProvider();
    await waitFor(() => expect(worldStateReads).toBeGreaterThan(0));
    // Deliberately no `open()`: the stream never connected.

    let outcome: unknown;
    await act(async () => {
      outcome = await submit?.();
    });

    expect(objectivePosts).toHaveLength(0);
    expect((outcome as { accepted: boolean; reason: string }).accepted).toBe(false);
    expect((outcome as { reason: string }).reason).toMatch(/not connected/i);
  });

  it("also catches up when the events arrive over the stream", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByText("No build yet.")).toBeInTheDocument());
    await act(async () => sources[0]?.open());

    // The backend's state changed without this client having asked for it
    // — the only signal is the event. This is the general case the defect
    // broke, of which objective submission is one instance.
    world = WORLD_WITH_BUILD;
    await act(async () => {
      for (const event of submissionEvents()) sources[0]?.deliver(event);
    });

    await waitFor(() => expect(screen.getByText(new RegExp(OBJECTIVE))).toBeInTheDocument());
  });
});

/**
 * AC-106 — backend-mode command honesty at the provider level.
 */
describe("BackendRuntimeProvider — command honesty (AC-106)", () => {
  function Probe() {
    const runtime = useRuntime();
    probe = runtime;
    return <StageAgentPanel selection={null} onSelect={() => {}} />;
  }

  function renderProbe() {
    return render(
      <BackendRuntimeProvider baseUrl={BASE_URL}>
        <Probe />
      </BackendRuntimeProvider>,
    );
  }

  it("states it is the backend runtime rather than leaving it to be inferred", async () => {
    renderProbe();
    await waitFor(() => expect(probe).not.toBeNull());
    expect(probe?.runtimeMode).toBe("backend");
  });

  it("refuses an unknown command type without sending it, and says it is unsupported", async () => {
    renderProbe();
    await waitFor(() => expect(worldStateReads).toBeGreaterThan(0));
    await act(async () => sources[0]?.open());
    const before = commandPosts.length;

    await act(async () => {
      probe?.submitCommand({ commandType: "demo.start", params: {} });
    });

    expect(commandPosts).toHaveLength(before);
    expect(probe?.lastRejection?.kind).toBe("unsupported");
    expect(probe?.lastRejection?.commandType).toBe("demo.start");
  });

  it("reports a disconnected backend as unreachable, not as an invalid command", async () => {
    renderProbe();
    await waitFor(() => expect(probe).not.toBeNull());
    // Never opened: the stream is down.
    await act(async () => {
      probe?.submitCommand({ commandType: "Approval.Approve", entityId: "a", params: {} });
    });
    expect(probe?.lastRejection?.kind).toBe("unreachable");
  });

  it("emits building.selected through the declared command (PV1-013)", async () => {
    renderProbe();
    await waitFor(() => expect(worldStateReads).toBeGreaterThan(0));
    await act(async () => sources[0]?.open());

    await act(async () => probe?.selectBuilding("warehouse"));

    const posted = commandPosts.at(-1) as { commandType: string; entityId: string };
    expect(posted.commandType).toBe("Building.Select");
    expect(posted.entityId).toBe("warehouse");
  });

  it("does not resubmit a repeat selection of the same building", async () => {
    renderProbe();
    await waitFor(() => expect(worldStateReads).toBeGreaterThan(0));
    await act(async () => sources[0]?.open());

    await act(async () => probe?.selectBuilding("warehouse"));
    const after = commandPosts.length;
    await act(async () => probe?.selectBuilding("warehouse"));
    expect(commandPosts).toHaveLength(after);

    await act(async () => probe?.selectBuilding("qa-building"));
    expect(commandPosts.length).toBeGreaterThan(after);
  });

  it("re-selects after a clear, because the selection genuinely changed again", async () => {
    renderProbe();
    await waitFor(() => expect(worldStateReads).toBeGreaterThan(0));
    await act(async () => sources[0]?.open());

    await act(async () => probe?.selectBuilding("warehouse"));
    const after = commandPosts.length;
    await act(async () => probe?.clearSelection());
    await act(async () => probe?.selectBuilding("warehouse"));
    expect(commandPosts.length).toBeGreaterThan(after);
  });

  it("never falls back to mock behaviour — no scripted events appear", async () => {
    renderProbe();
    await waitFor(() => expect(worldStateReads).toBeGreaterThan(0));
    await act(async () => sources[0]?.open());
    // The mock runtime auto-issues demo.start on mount and emits a 1,043-line
    // canonical script. Backend mode must show only what the backend sent.
    expect(probe?.events).toEqual([]);
    expect(
      commandPosts.some((c) =>
        String((c as { commandType: string }).commandType).startsWith("demo."),
      ),
    ).toBe(false);
  });
});
