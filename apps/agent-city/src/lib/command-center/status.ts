/**
 * Read-side status for the Command Center aggregate snapshot.
 *
 * Distinct from world-projection status: a transport failure must never
 * collapse into an empty “successful” Command Center view.
 */
export type CommandCenterStatus =
  | "disconnected"
  | "loading"
  | "current"
  | "stale"
  | "invalid_contract"
  | "unavailable";

export function commandCenterStatusLabel(status: CommandCenterStatus): string {
  switch (status) {
    case "disconnected":
      return "Disconnected";
    case "loading":
      return "Loading";
    case "current":
      return "Current";
    case "stale":
      return "Stale";
    case "invalid_contract":
      return "Invalid contract";
    case "unavailable":
      return "Unavailable";
  }
}
