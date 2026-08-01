import { AppShell } from "@/components/shell/AppShell";
import { RuntimeProvider } from "@/lib/mock-runtime";
import { BackendRuntimeProvider } from "@/lib/backend/BackendRuntimeProvider";

// FBL-026: the runtime is selectable. The deterministic mock runtime
// (ADR-001) remains the default so tests and demo mode keep working with
// no backend running; setting NEXT_PUBLIC_FOUNDRY_API_URL points the app
// at a real backend instead, making it a live projection of backend truth.
const backendUrl = process.env.NEXT_PUBLIC_FOUNDRY_API_URL;

export default function Home() {
  if (backendUrl) {
    return (
      <BackendRuntimeProvider baseUrl={backendUrl}>
        <AppShell />
      </BackendRuntimeProvider>
    );
  }

  return (
    <RuntimeProvider>
      <AppShell />
    </RuntimeProvider>
  );
}
