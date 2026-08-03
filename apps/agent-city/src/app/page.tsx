import { AppShell } from "@/components/shell/AppShell";
import { RuntimeProvider } from "@/lib/mock-runtime";
import { BackendRuntimeProvider } from "@/lib/backend/BackendRuntimeProvider";
import { resolveRuntimeSelection } from "@/lib/runtimeMode";

/**
 * AC-105: the runtime is selected **per request**, not per build.
 *
 * `force-dynamic` is what makes that true. Without it this page is
 * prerendered at build time and the selection below is frozen into the
 * artifact — which is precisely the defect PV1-028 recorded, and why the
 * app's README had to be corrected at AC-101 for claiming the runtime was
 * selectable when a built artifact was permanently one mode.
 *
 * The URL is read on the server and handed to the client provider as a
 * prop. It is configuration, not a credential; the operator credential
 * never travels this way (see `credentialHandoff.ts`).
 */
export const dynamic = "force-dynamic";

export default function Home() {
  const { backendUrl } = resolveRuntimeSelection(process.env);

  if (backendUrl) {
    return (
      <BackendRuntimeProvider baseUrl={backendUrl}>
        <AppShell />
      </BackendRuntimeProvider>
    );
  }

  // The deterministic mock runtime (ADR-001) remains the default, so the
  // app still runs with no backend and no configuration at all.
  return (
    <RuntimeProvider>
      <AppShell />
    </RuntimeProvider>
  );
}
