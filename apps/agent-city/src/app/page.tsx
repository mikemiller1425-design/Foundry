import { AppShell } from "@/components/shell/AppShell";
import { RuntimeProvider } from "@/lib/mock-runtime";

export default function Home() {
  return (
    <RuntimeProvider>
      <AppShell />
    </RuntimeProvider>
  );
}
