import { existsSync, readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { isLoopbackHost, readHandoffCredential } from "@/lib/backend/credentialHandoff";

/**
 * The browser's end of the local credential handoff (AC-105).
 *
 * `force-dynamic` and `no-store` are load-bearing, not boilerplate: a
 * cached or statically-rendered answer would either bake a credential into
 * the build — the exact thing F-104 forbids — or keep serving a token from
 * an API session that has since restarted.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<NextResponse> {
  const host = request.headers.get("host");
  if (!isLoopbackHost(host)) {
    // The credential is for the person at this machine. Anyone reaching
    // this route from elsewhere is told plainly rather than handed a token.
    return NextResponse.json(
      {
        available: false,
        reason:
          "The credential handoff is available on this host only. Paste the credential manually.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = readHandoffCredential({
    env: process.env,
    exists: (path) => existsSync(path),
    readFile: (path) => readFileSync(path, "utf-8"),
  });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
