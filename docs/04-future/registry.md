# Future Registry

**Foundation:** 1.0-rc1  
**Status:** Non-active — **none of these concepts are V1 scope**  
**Rule:** Preserve ideas here; only the active mission may be implemented

Shared V1-compatible hooks for all concepts: stable IDs, event provenance, capability labels, audit history, adapter boundaries.

---

## Company campuses

| Field | Content |
| --- | --- |
| Insight | Organizations become first-class tenants with workforce, budgets, and buildings |
| Purpose | Dedicated campuses for real companies employing agents |
| Real-world equivalent | Corporate campus / tenant workspace |
| Potential entities | Company, Campus, Lease, ServiceAgreement |
| Potential events | `company.registered`, `campus.provisioned` |
| Dependencies | Multi-tenancy, isolation, governance |
| Risks | Data isolation failures; visual overload |
| V1 hooks | Stable building/agent IDs; no campus UI now |
| Status | Future Registry |
| Earliest epoch | Post–multi-project Agent City |

## Real-company agent requisitions and hiring

| Field | Content |
| --- | --- |
| Insight | New agents enter through governed requisition, not spontaneous spawn |
| Purpose | Create positions from approved company requests |
| Real-world equivalent | Job requisition / hiring pipeline |
| Potential entities | Requisition, Candidate, Offer, OnboardingPlan |
| Potential events | `requisition.approved`, `agent.hired` |
| Dependencies | Campuses, Academy, Treasury |
| Risks | Agent sprawl; unclear accountability |
| V1 hooks | Agent registry + authority fields |
| Status | Future Registry |
| Earliest epoch | After campuses + identity maturity |

## Agent Academy

| Field | Content |
| --- | --- |
| Insight | Validated performance should govern authority without cosmetic XP |
| Purpose | Curriculum, evaluation, certification for agents |
| Real-world equivalent | Corporate university / apprenticeship |
| Potential entities | Curriculum, Course, Certification, Cohort |
| Potential events | `academy.enrolled`, `certification.granted` |
| Dependencies | Metrics, evaluation engine, governance |
| Risks | Overfit training; unsafe authority grants |
| V1 hooks | Performance summaries; evidence artifacts |
| Status | Future Registry |
| Earliest epoch | After reliable evaluation loops |

## Curriculum / Certifications / Graduation

| Field | Content |
| --- | --- |
| Insight | Structured learning paths produce portable capability claims |
| Purpose | Define what agents must demonstrate before authority increases |
| Real-world equivalent | Syllabus, credentials, commencement |
| Potential entities | Module, Exam, Certificate, GraduationRecord |
| Potential events | `curriculum.completed`, `agent.graduated` |
| Dependencies | Academy |
| Risks | Credential inflation |
| V1 hooks | Capability labels on agents/buildings |
| Status | Future Registry |
| Earliest epoch | With Academy |

## Internships during production hours

| Field | Content |
| --- | --- |
| Insight | Learners can contribute under supervision without full authority |
| Purpose | Bounded production participation for trainees |
| Real-world equivalent | Internship / co-op |
| Potential entities | InternshipAssignment, MentorLink |
| Potential events | `internship.started`, `internship.completed` |
| Dependencies | Academy, risk classes, supervision |
| Risks | Trainee errors in production paths |
| V1 hooks | RiskClass on tasks; pause controls |
| Status | Future Registry |
| Earliest epoch | After R2+ supervision tooling |

## Hardening and replay during low-demand hours

| Field | Content |
| --- | --- |
| Insight | Idle capacity can improve reliability via replay and drills |
| Purpose | Scheduled hardening, regression replay, chaos drills off-peak |
| Real-world equivalent | Nightly batch / game-day exercises |
| Potential entities | DrillPlan, ReplayJob |
| Potential events | `hardening.started`, `replay.completed` |
| Dependencies | Event store, sandbox runtimes |
| Risks | Interference with live work |
| V1 hooks | Immutable events; demo replay controls |
| Status | Future Registry |
| Earliest epoch | After event store maturity |

## Promotions and authority progression

| Field | Content |
| --- | --- |
| Insight | Authority should track evidenced capability |
| Purpose | Promote agents and expand permissions deliberately |
| Real-world equivalent | Promotion / clearance upgrade |
| Potential entities | PromotionCase, AuthorityGrant |
| Potential events | `authority.granted`, `agent.promoted` |
| Dependencies | Certifications, audit, policy |
| Risks | Premature privilege |
| V1 hooks | `authorityLevel` field; approval audits |
| Status | Future Registry |
| Earliest epoch | With Academy certifications |

## City Hall

| Field | Content |
| --- | --- |
| Insight | Central governance differs from workplace execution |
| Purpose | Policy, charters, civic oversight |
| Real-world equivalent | Municipal / corporate HQ governance |
| Potential entities | Policy, Charter, Ordinance |
| Potential events | `policy.enacted`, `charter.amended` |
| Dependencies | Multi-workflow city |
| Risks | Single-point control opacity |
| V1 hooks | Lighthouse as governance seed |
| Status | Future Registry |
| Earliest epoch | Multi-district city |

## Treasury

| Field | Content |
| --- | --- |
| Insight | Real costs and budgets constrain autonomy |
| Purpose | Track spend, budgets, cost attribution |
| Real-world equivalent | Finance / FP&A |
| Potential entities | Budget, LedgerEntry, CostCenter |
| Potential events | `budget.allocated`, `cost.recorded` |
| Dependencies | Accounting integrations; R5 controls |
| Risks | Regulatory exposure; bad incentives |
| V1 hooks | Optional `costUsd` on AgentRun |
| Status | Future Registry |
| Earliest epoch | After R3–R5 mission |

## Planning Office

| Field | Content |
| --- | --- |
| Insight | Planning is a distinct institution from execution |
| Purpose | Portfolio and capacity planning |
| Real-world equivalent | PMO / planning department |
| Potential entities | Portfolio, CapacityPlan |
| Potential events | `plan.proposed`, `plan.accepted` |
| Dependencies | Strategic Planning, metrics |
| Risks | False precision |
| V1 hooks | Build/stage planning artifacts |
| Status | Future Registry |
| Earliest epoch | Multi-project |

## Records Office

| Field | Content |
| --- | --- |
| Insight | Long-term records differ from hot operational events |
| Purpose | Retention, discovery, compliance archives |
| Real-world equivalent | Records management |
| Potential entities | RecordSeries, RetentionPolicy |
| Potential events | `record.archived`, `retention.applied` |
| Dependencies | Event store, legal policy |
| Risks | Over-retention / under-retention |
| V1 hooks | Append-only events; artifact archive status |
| Status | Future Registry |
| Earliest epoch | Compliance-driven missions |

## Opportunity Center

| Field | Content |
| --- | --- |
| Insight | A local commercial opportunity should move through a governed evidence chain: public-business discovery, identity verification, website assessment, qualification, private prototype, independent review, proposal, and human-approved outreach. The world visualizes that real chain; it never invents prospects or activity. |
| Purpose | Discover small businesses within an operator-approved geographic boundary, verify their official public websites, identify evidence-backed improvement opportunities, create bounded clean-room prototypes for qualified cases, and prepare proposals without autonomously contacting or impersonating a business. |
| Real-world equivalent | Local business-development center combining market research, web consultancy, solutions architecture, proposal operations, and compliance review |
| Potential entities | OpportunityCase, GeographicSearch, BusinessRecord, SourceRecord, DomainCandidate, IdentityMatch, WebsiteSnapshot, SiteAssessment, Finding, OpportunityScore, ContactPolicyCheck, PrototypeBrief, PrivatePrototype, ValidationReport, ProposalPackage, OutreachDraft, SuppressionRecord |
| Potential events | `opportunity.search_authorized`, `business.discovered`, `business.deduplicated`, `domain.candidate_found`, `domain.verified`, `site.snapshot_captured`, `site.assessed`, `opportunity.qualified`, `opportunity.disqualified`, `compliance.cleared`, `prototype.authorized`, `prototype.created`, `prototype.validation_failed`, `prototype.validated`, `proposal.prepared`, `outreach.approval_requested`, `outreach.approved`, `outreach.rejected`, `contact.suppressed` |
| Dependencies | V1.1 real-build orchestration; bounded disposable workspaces; provenance and evidence retention; independent Inspector validation; human approval gates; external-source adapter policy; robots/terms/rate-limit controls; geographic-query and business-directory adapters; domain-verification confidence model; contact suppression and opt-out controls; jurisdiction-specific legal review before activation |
| Risks | Incorrect business identity or domain; stale or duplicated listings; collection that violates source terms or robots policy; excessive request rates; privacy and marketing-law exposure; unsupported or insulting website claims; copied copyrighted content or branding; insecure generated prototypes; accidental public deployment; spam; repeated contact after opt-out; reputational harm; presenting a prototype as authorized by the business |
| V1 hooks | Agent identity and residences; workplace assignment; objective/build/stage/task/artifact graph; append-only provenance; R0–R2 ceiling; independent Inspector; approval queue; event-driven transfers; Lighthouse attention; runtime-adapter boundary |
| Status | Future Registry |
| Earliest epoch | Discovery and assessment pilot after V1.1 operational readiness; private prototype workflow after repeatable bounded builds; external outreach only in a separately reviewed V2 commercial-operations mission |

### Opportunity Center operating model

The Opportunity Center is a **workplace and governed workflow**, not one oversized scraping agent. Persistent workers keep their identities at their residences and accept bounded assignments inside the Center.

| Worker | Responsibility | Authority boundary |
| --- | --- | --- |
| Scout Agent | Discover public business records inside an operator-approved ZIP code or geographic boundary and record source provenance | Cannot contact businesses, infer private facts, bypass source controls, or widen geography |
| Identity Agent | Deduplicate records and verify the official business domain using multiple public signals and confidence scoring | Cannot treat an unverified directory link or social profile as an official website |
| Site Inspector Agent | Capture an approved public snapshot and measure accessibility, mobile behavior, performance, security posture, SEO fundamentals, content structure, and interaction quality | Reports observable evidence; cannot make unsupported legal, revenue, or quality claims |
| Opportunity Agent | Score fit, likely improvement value, confidence, feasibility, and disqualification conditions | Cannot authorize prototype work or external contact |
| Compliance Agent | Enforce source policy, collection limits, contact eligibility, suppression, opt-out, and jurisdictional rules | May block progression; cannot be overridden silently by another agent |
| Architect Agent | Reused Foundry worker that produces a bounded prototype brief and acceptance criteria | Cannot copy a production site wholesale or authorize execution |
| Builder Agent | Reused Foundry worker that creates a private clean-room prototype in a disposable workspace | Cannot deploy publicly, modify the real business site, or validate its own work |
| Inspector Agent | Reused independent worker that validates the prototype and improvement claims | Must remain independent from Builder execution |
| Proposal Agent | Packages verified findings, private prototype evidence, scope, assumptions, and pricing inputs | Cannot claim affiliation, guarantee outcomes, or send outreach |
| Outreach Agent | Drafts a personalized message from the approved evidence package | Draft-only; every send requires a human approval and suppression check |

### Opportunity case state flow

```text
Operator authorizes geography and sources
  -> Scout discovers public business record
  -> Identity verifies business and official domain
  -> Site Inspector produces evidence-backed assessment
  -> Opportunity Agent qualifies or archives the case
  -> Compliance clears or blocks prototype eligibility
  -> Human authorizes bounded prototype work
  -> Architect plans
  -> Builder creates private clean-room prototype
  -> Independent Inspector validates or returns revision
  -> Proposal Agent prepares evidence package
  -> Compliance rechecks contact eligibility
  -> Human approves, rejects, or revises outreach
  -> Outreach Agent may send only through a separately authorized adapter
```

No vehicle, cargo, building signal, or timeline event may advance ahead of the corresponding declared backend event. A private prototype is an artifact, not a representation that the business requested, endorsed, or owns the work.

### Activation boundaries

- Public discovery, website assessment, prototype generation, and outreach are separate authority grants.
- An operator must approve geography, sources, collection policy, and rate limits before discovery.
- Only verified official domains may reach assessment.
- Only qualified and compliance-cleared cases may reach prototype authorization.
- Prototypes remain private and use only the minimum public content necessary to demonstrate structure and capability; protected assets should be replaced with neutral placeholders unless licensed.
- External contact remains impossible until a dedicated outreach adapter, suppression registry, audit trail, and human approval gate are reviewed and activated.
- Autonomous bulk outreach, purchased personal-contact enrichment, credentialed access to business systems, public deployment, and modification of a business's real website remain excluded.

## Market Intelligence

| Field | Content |
| --- | --- |
| Insight | Outward sensing must separate from decision authority |
| Purpose | Structure external demand and competitor signals |
| Real-world equivalent | Market research function |
| Potential entities | Signal, Source, UncertaintyScore |
| Potential events | `signal.collected`, `source.evaluated` |
| Dependencies | External integrations; legal review |
| Risks | Bias, scraping limits, hallucinated claims |
| V1 hooks | Provenance on artifacts |
| Status | Future Registry |
| Earliest epoch | After external integration mission |

## Strategic Planning

| Field | Content |
| --- | --- |
| Insight | Recommendation ≠ raw discovery |
| Purpose | Prioritize opportunities against goals and risk |
| Real-world equivalent | Strategy office |
| Potential entities | StrategyCase, Scenario |
| Potential events | `strategy.proposed`, `strategy.deferred` |
| Dependencies | Opportunity Center, Treasury |
| Risks | Over-centralization |
| V1 hooks | Objective + risk fields on builds |
| Status | Future Registry |
| Earliest epoch | With Opportunity Center |

## Economic Development

| Field | Content |
| --- | --- |
| Insight | Productive value should track real capability, not tokens |
| Purpose | Grow productive capacity of the autonomous organization |
| Real-world equivalent | Economic development agency |
| Potential entities | DevelopmentProgram, Incentive |
| Potential events | `program.launched`, `capacity.expanded` |
| Dependencies | Treasury, campuses, Academy |
| Risks | Gaming metrics |
| V1 hooks | Capability-based upgrades (Warehouse L2 seed) |
| Status | Future Registry |
| Earliest epoch | Multi-capability progression |

## Company-specific buildings / District expansion / Logistics networks / Warehouses and production chains

| Field | Content |
| --- | --- |
| Insight | Spatial scale follows organizational scale; logistics mirrors real dependency graphs |
| Purpose | Expand from one neighborhood to districts, tenant buildings, and multi-hop production |
| Real-world equivalent | Industrial parks, supply chains |
| Potential entities | District, LogisticsEdge, ProductionLine |
| Potential events | `district.opened`, `shipment.routed`, `line.completed` |
| Dependencies | Multi-transfer engine, tenancy |
| Risks | Complexity explosion; decorative sprawl |
| V1 hooks | Single transfer + warehouse inventory model |
| Status | Future Registry |
| Earliest epoch | After V1 transfer engine proven |

## Broader organizational governance

| Field | Content |
| --- | --- |
| Insight | Separate command, policy, budget, validation, and execution |
| Purpose | Checks and balances across institutions |
| Real-world equivalent | Corporate governance |
| Potential entities | Board, PolicySet, EscalationPath |
| Potential events | `governance.escalated`, `policy.enforced` |
| Dependencies | City Hall, Treasury, Records |
| Risks | Opaque escalation |
| V1 hooks | Approval + audit trail |
| Status | Future Registry |
| Earliest epoch | Multi-institution city |

## Monetary and productive value represented by agent capability

| Field | Content |
| --- | --- |
| Insight | Value should map to evidenced capability and outcomes, not fictional currency games |
| Purpose | Attribute productive value to agents/buildings without a toy economy |
| Real-world equivalent | Unit economics / productivity accounting |
| Potential entities | ValueAttribution, CapabilityYield |
| Potential events | `value.attributed`, `yield.measured` |
| Dependencies | Treasury, reliable metrics |
| Risks | Misleading attribution; unsafe autonomy incentives |
| V1 hooks | Metrics used for Warehouse upgrade eligibility |
| Status | Future Registry |
| Earliest epoch | With Treasury |

---

## How to add a concept

1. Confirm it is not required for the active mission.  
2. Add a section with all fields above.  
3. Do not create implementation work that treats it as in-scope.  
4. Return to `docs/01-mission/active-mission.md`.
