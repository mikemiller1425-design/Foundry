import { randomBytes, timingSafeEqual } from "node:crypto";
import type { ActorType } from "@foundry/event-types";

/**
 * Authenticated command identity (FBL-029).
 *
 * Before this rung, a command's actor was whatever the request body
 * claimed. That is fine for an audit trail nobody is trying to defeat,
 * but it is not a basis for an authorization decision: F-05 requires
 * that only an Inspector can produce `stage.validation_passed`, and a
 * check against a self-declared `actorId` is satisfied by anyone willing
 * to type `"agent-inspector"`.
 *
 * So identity here is established by a **credential the backend issued**,
 * never by a field the caller filled in. The registry maps an opaque
 * bearer token to the principal it was minted for. A caller with no
 * credential is anonymous — explicitly *not* an agent — which is what
 * makes "frontend attempts to self-certify" a rejection rather than an
 * accident of naming.
 *
 * Two deliberate boundaries:
 *
 * - **Role is never carried by the credential.** The token establishes
 *   *who*; the authoritative role is re-read from persisted Agent state
 *   at decision time (`commandHandler`). A stolen or stale token can
 *   therefore never assert a role its agent does not actually hold.
 * - **Tokens are never persisted and never logged.** They live in memory
 *   for the process's lifetime and are absent from the event log, so
 *   replaying history can never leak a credential.
 *
 * This is deliberately not a general authentication system — V1 excludes
 * one. It is the smallest mechanism that makes the F-05 guard mean
 * something, and it is scoped to exactly that job.
 */

export interface Principal {
  actorType: ActorType;
  actorId: string;
  /**
   * True only when the identity was established by a backend-issued
   * credential. A guard that authorizes on identity must require this —
   * otherwise it is trusting a claim again, one indirection later.
   */
  authenticated: boolean;
}

/** The principal for any caller that presented no valid credential. */
export const ANONYMOUS_PRINCIPAL: Principal = Object.freeze({
  actorType: "frontend",
  actorId: "anonymous",
  authenticated: false,
});

const TOKEN_BYTES = 32;

export class PrincipalRegistry {
  private readonly byToken = new Map<string, Principal>();

  /**
   * Mints a credential for an agent. The caller is responsible for
   * delivering it to that agent's runtime; it is never sent to the
   * browser, because the browser is not an agent.
   */
  issueAgentCredential(agentId: string): string {
    return this.issue({ actorType: "agent", actorId: agentId, authenticated: true });
  }

  /** Mints a credential for a human operator (used from FBL-030 onward). */
  issueOperatorCredential(operatorId: string): string {
    return this.issue({ actorType: "operator", actorId: operatorId, authenticated: true });
  }

  private issue(principal: Principal): string {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    this.byToken.set(token, Object.freeze(principal));
    return token;
  }

  /**
   * Resolves a bearer token to its principal, or the anonymous principal
   * when the token is missing or unknown.
   *
   * An unknown token is *not* an error to report back in detail — a
   * caller learning "that token exists but isn't an Inspector" is a
   * probing oracle. It simply resolves to anonymous, and the guard that
   * follows denies with the same message it gives everyone else.
   */
  resolve(token: string | undefined | null): Principal {
    if (!token) return ANONYMOUS_PRINCIPAL;

    // Constant-time comparison against each known token. The set is
    // three-to-four entries in V1, so the cost is irrelevant and the
    // timing side channel is closed rather than argued about.
    let found: Principal | undefined;
    const candidate = Buffer.from(token, "utf8");
    for (const [known, principal] of this.byToken) {
      const knownBuffer = Buffer.from(known, "utf8");
      if (knownBuffer.length !== candidate.length) continue;
      if (timingSafeEqual(knownBuffer, candidate)) found = principal;
    }
    return found ?? ANONYMOUS_PRINCIPAL;
  }

  revoke(token: string): void {
    this.byToken.delete(token);
  }

  /** Number of live credentials. Diagnostics only — never exposes tokens. */
  get size(): number {
    return this.byToken.size;
  }
}

/** Parses `Authorization: Bearer <token>`; returns undefined for anything else. */
export function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1];
}
