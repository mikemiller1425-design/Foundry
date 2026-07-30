import { REGION_PLACEHOLDER } from "./regionPlaceholder";

// Ultrawide application shell (FBL-005): static full-viewport region layout
// only. No operational data, no mock runtime, no interaction behavior — see
// docs/02-specification/interface-model.md for the region contract this
// implements, and FBL-006+ for interactive/panel behavior.
export function AppShell() {
  return (
    <div
      data-testid="shell-root"
      className="grid h-dvh w-dvw grid-rows-[6vh_1fr_20vh_6vh] overflow-hidden bg-neutral-950 text-neutral-100"
    >
      <header
        data-testid="shell-top-bar"
        aria-label="System status bar"
        className="flex items-center gap-4 border-b border-neutral-800 px-4 text-sm"
      >
        <span className="font-medium">Agent City — top system bar</span>
        <span className="text-neutral-400">{REGION_PLACEHOLDER}</span>
      </header>

      <div className="grid grid-cols-[15%_1fr_22%] overflow-hidden">
        <nav
          data-testid="shell-left-nav"
          aria-label="Primary navigation"
          className="overflow-y-auto border-r border-neutral-800 p-4 text-sm"
        >
          <h2 className="font-medium">Left navigation</h2>
          <p className="mt-2 text-neutral-400">{REGION_PLACEHOLDER}</p>
        </nav>

        <main
          data-testid="shell-world"
          aria-label="Operational world"
          className="relative overflow-hidden p-4 text-sm"
        >
          <h2 className="font-medium">Central operational world</h2>
          <p className="mt-2 text-neutral-400">{REGION_PLACEHOLDER}</p>

          <aside
            data-testid="shell-detail-panel"
            aria-label="Selected object details"
            className="absolute right-4 bottom-4 w-64 rounded border border-neutral-800 bg-neutral-900/90 p-3 text-xs"
          >
            <h3 className="font-medium">Selected-object details</h3>
            <p className="mt-1 text-neutral-400">No selection. {REGION_PLACEHOLDER}</p>
          </aside>
        </main>

        <aside
          data-testid="shell-intel"
          aria-label="Live intelligence"
          className="overflow-y-auto border-l border-neutral-800 p-4 text-sm"
        >
          <h2 className="font-medium">Right live-intelligence</h2>
          <p className="mt-2 text-neutral-400">{REGION_PLACEHOLDER}</p>
        </aside>
      </div>

      <section
        data-testid="shell-timeline"
        aria-label="Event timeline"
        className="overflow-y-auto border-t border-neutral-800 p-4 text-sm"
      >
        <h2 className="font-medium">Bottom event timeline (collapsible)</h2>
        <p className="mt-2 text-neutral-400">{REGION_PLACEHOLDER}</p>
      </section>

      <footer
        data-testid="shell-command-input"
        aria-label="Command input"
        className="flex items-center gap-2 border-t border-neutral-800 px-4"
      >
        <label htmlFor="command-input" className="sr-only">
          Command input
        </label>
        <input
          id="command-input"
          type="text"
          disabled
          placeholder="Command input — available in a later build ladder rung"
          className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-400 disabled:cursor-not-allowed"
        />
      </footer>
    </div>
  );
}
