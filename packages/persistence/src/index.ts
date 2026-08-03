export {
  createInitialEntityState,
  reduceEntities,
  ENTITY_TYPES,
  SYSTEM_ACTOR_ID,
  type EntityRef,
  type EntityState,
  type EntityType,
  type ReduceResult,
  type StageValidationHistory,
  type StageValidationRecord,
} from "./reducer";

export { ANONYMOUS_PRINCIPAL, PrincipalRegistry, bearerToken, type Principal } from "./principals";
export { projectWorldState } from "./worldStateProjection";
export {
  PersistenceService,
  type AppendEventResult,
  type ReconcileResult,
} from "./persistenceService";
export {
  COMMAND_DEFINITIONS,
  ENTITY_TYPE_LABELS,
  type CommandDefinition,
} from "./commandDefinitions";
export { TRANSITION_GRAPHS, isLegalTransition, type TransitionGraph } from "./transitionGraphs";
export {
  CommandHandler,
  INSPECTOR_AGENT_ID,
  type CommandActor,
  type CommandOutcome,
} from "./commandHandler";
export {
  ObjectiveIntake,
  type ObjectiveIdFactory,
  type ObjectiveIntakeResult,
  type ObjectiveIssue,
  type ObjectiveRejectionCode,
} from "./objectiveIntake";
