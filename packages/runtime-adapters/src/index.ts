/**
 * `@foundry/runtime-adapters` — the runtime policy boundary (ADR-006).
 *
 * Backend-only by construction. Nothing here is importable from
 * `apps/agent-city`: the frontend reaches runtimes through the backend
 * API (FBL-024/025) and the event stream (FBL-026), never by invoking an
 * adapter itself.
 */

export {
  defineRuntimePolicy,
  RuntimePolicySchema,
  CommandRuleSchema,
  ArgumentRuleSchema,
  ExecutionLimitsSchema,
  RISK_CLASS_ORDER,
  type RuntimePolicy,
  type CommandRule,
  type ArgumentRule,
  type ExecutionLimits,
} from "./policy";

export {
  DENIAL_CODES,
  allow,
  deny,
  type DenialCode,
  type PolicyDecision,
  type PolicyDenial,
} from "./denial";

export {
  canonicalizeExistingPrefix,
  canonicalizeRoots,
  isWithinRoot,
  resolveContainedPath,
  type ContainmentContext,
} from "./containment/paths";

export { evaluateCommand, type ResolvedCommand } from "./containment/commands";
export { buildChildEnvironment, type BuiltEnvironment } from "./containment/environment";

export { Redactor, REDACTION_PLACEHOLDER } from "./redaction";
export { deepFreeze, finalizeEvidence, serializedSize } from "./evidence";

export { resolveExecutable } from "./execution/executable";
export { runProcess, type SpawnOutcome, type SpawnParameters } from "./execution/processRunner";

export {
  PolicyBoundary,
  processExecutionBackend,
  type BoundaryOptions,
  type ExecutionBackend,
} from "./boundary";

export {
  MockRuntimeAdapter,
  type MockAdapterOptions,
  type MockCommandScript,
} from "./adapters/mockAdapter";

export {
  ClaudeCodeAdapter,
  CONTROLLED_TOOLS,
  buildClaudeCodePolicy,
  controlledClaudeArgs,
  type ClaudeCodeAdapterOptions,
  type ClaudeCodeProfile,
} from "./adapters/claudeCodeAdapter";

export {
  ALLOWED_WRITE_PATHS,
  TASK_SPECIFICATION,
  createFixtureRepository,
  type Fixture,
} from "./controlledStage/fixture";

export {
  buildValidationPolicy,
  establishBaseline,
  parsePorcelain,
  runIndependentTests,
  verifyWriteScope,
  type TestValidationResult,
  type ValidationOptions,
  type ValidationProfile,
  type WriteScopeResult,
} from "./controlledStage/validation";

export {
  fileManifest,
  runControlledStage,
  type ControlledStageEvidence,
  type ControlledStageOptions,
  type ControlledStageOutcome,
  type ControlledStageRequest,
  type FileManifestEntry,
} from "./controlledStage/runControlledStage";

export type {
  CapturedOutput,
  CommandExecutionRecord,
  CommandInvocation,
  CommandOutcomeStatus,
  RunEvidence,
  RunRequest,
  RunResult,
  RunStatus,
  RuntimeAdapter,
} from "./types";
