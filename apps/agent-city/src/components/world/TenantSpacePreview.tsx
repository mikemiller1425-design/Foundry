"use client";

import { findFixtureTenantSpace } from "@/lib/world/tenantSpaces";
import { useState } from "react";
import type { AgentRole } from "@foundry/contracts";

const ROLE_GLYPH: Record<AgentRole, string> = {
  architect: "◇",
  builder: "⬡",
  inspector: "△",
};

export function TenantSpacePreview({
  tenantId,
  onClose,
}: {
  tenantId: string;
  onClose: () => void;
}) {
  const tenant = findFixtureTenantSpace(tenantId);
  const [selectedRole, setSelectedRole] = useState<AgentRole>("architect");
  if (!tenant) return null;
  const access = tenant.agentAccess.find((candidate) => candidate.role === selectedRole)!;

  return (
    <section
      aria-label={`${tenant.name} fixture showroom`}
      className="absolute inset-0 z-30 overflow-y-auto bg-[#070d18]/97 p-4 backdrop-blur-md sm:p-7"
    >
      <div className="mx-auto flex min-h-full max-w-6xl flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="foundry-eyebrow">Fixture tenant showroom</p>
            <h1 className="mt-1 text-xl font-semibold text-white sm:text-3xl">{tenant.name}</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-500">
              {tenant.archetype}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="foundry-chip shrink-0 rounded-full px-3 py-1.5 text-[10px] text-neutral-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            Exit preview
          </button>
        </header>

        <div className="mt-5 grid flex-1 gap-4 lg:grid-cols-[1.05fr_1.4fr]">
          <div
            className="relative min-h-64 overflow-hidden rounded-[2rem] border border-white/10 p-6"
            style={{
              background: `radial-gradient(circle at 28% 24%, ${tenant.accent}33, transparent 34%), radial-gradient(circle at 78% 68%, ${tenant.secondary}22, transparent 38%), #0c1626`,
            }}
          >
            <div className="absolute inset-5 rounded-[1.5rem] border border-white/8" />
            <div className="relative flex h-full min-h-52 flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-slate-400">
                  Visual prototype
                </span>
                <span className="text-[9px] uppercase tracking-[0.1em] text-slate-500">
                  No tenancy
                </span>
              </div>
              <div>
                <div
                  aria-hidden="true"
                  className="mb-4 grid size-16 place-items-center rounded-3xl border text-2xl"
                  style={{ borderColor: `${tenant.accent}88`, color: tenant.accent }}
                >
                  F
                </div>
                <p className="max-w-md text-lg leading-snug text-slate-100 sm:text-2xl">
                  {tenant.tagline}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#0d1728]/95 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="foundry-eyebrow">Agent access preview</p>
                <h2 className="mt-1 text-sm font-medium text-white sm:text-base">
                  Imagine the relationship, without granting it
                </h2>
              </div>
              <span className="rounded-full border border-amber-300/20 px-2 py-1 text-[8px] uppercase tracking-[0.08em] text-amber-200">
                Not granted
              </span>
            </div>

            <div
              role="tablist"
              aria-label="Preview agent roles"
              className="mt-5 grid grid-cols-3 gap-2"
            >
              {tenant.agentAccess.map((candidate) => (
                <button
                  key={candidate.role}
                  type="button"
                  role="tab"
                  aria-selected={selectedRole === candidate.role}
                  onClick={() => setSelectedRole(candidate.role)}
                  className="rounded-xl border border-white/10 bg-black/15 p-3 text-left text-slate-500 aria-selected:border-sky-300/35 aria-selected:bg-sky-300/8 aria-selected:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                >
                  <span className="block text-lg" aria-hidden="true">
                    {ROLE_GLYPH[candidate.role]}
                  </span>
                  <span className="mt-1 block text-[9px] capitalize sm:text-[10px]">
                    {candidate.role}
                  </span>
                </button>
              ))}
            </div>

            <div role="tabpanel" className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-4">
              <p className="text-xs font-medium text-slate-200">{access.label}</p>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                {access.hypotheticalUse}
              </p>
              <dl className="mt-4 space-y-1 border-t border-white/8 pt-3 text-[9px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">access state</dt>
                  <dd className="text-amber-300">not granted</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">runtime action</dt>
                  <dd className="text-slate-400">none</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">backend record</dt>
                  <dd className="text-slate-400">none</dd>
                </div>
              </dl>
            </div>

            <ol className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Hypothetical tenant journey">
              {["Shape a bounded brief", "Observe declared work", "Review evidence references"].map(
                (step, index) => (
                  <li
                    key={step}
                    className="rounded-xl border border-white/8 p-3 text-[9px] text-slate-400"
                  >
                    <span className="mb-1 block font-mono text-slate-600">0{index + 1}</span>
                    {step}
                  </li>
                ),
              )}
            </ol>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-violet-300/15 bg-violet-300/5 px-4 py-3 text-[9px] leading-relaxed text-violet-200">
          Frontend fixture only. This showroom creates no tenant, lease, ownership, identity,
          credential, payment, authorization, agent permission, task, event, or execution.
        </p>
      </div>
    </section>
  );
}
