import { z } from "zod";
import { V1RiskClassSchema } from "./common";

/**
 * The bounded objective envelope (AC-103 — V1.1 first slice).
 *
 * `commands.ts` deliberately validated only the command *envelope*,
 * recording that "domain-model.md names each command but does not specify
 * per-command parameter fields" and that per-command parameter validation
 * belongs to the rung "once there is real enforcement logic to consume
 * those parameters". Submitting an objective is that rung: it is the first
 * command whose parameters are typed by a human rather than by a script,
 * so it is the first one whose shape has to be a contract.
 *
 * The shape here is the whole safety story of this slice. Nothing plans
 * and nothing executes — a submitted objective creates a `Project` and a
 * `Build` and stops — so the envelope's job is to make an unbounded or
 * out-of-policy request *unrepresentable*, not to sanitise it later:
 *
 * - **Bounded free text.** A length floor and ceiling, printable single-line
 *   characters only. `interface-model.md` § "Persistent command input"
 *   prohibits "unrestricted natural-language autonomous planning or shell
 *   execution" — this is bounded text that reaches neither a planner nor a
 *   shell, which is a different thing from unrestricted text that does.
 * - **One permitted workspace.** `foundry_managed` is the only member of
 *   the enum, so an operator-nominated path or a real project directory
 *   cannot be *expressed*, let alone honoured. Write confinement for a
 *   real run is post-hoc detection rather than prevention, so the only
 *   defensible workspace is one Foundry creates and destroys itself.
 * - **R0–R2 only.** `V1RiskClassSchema` keeps R3–R5 unrepresentable
 *   (principle 19).
 * - **No unknown fields.** `.strict()` — a caller that invents a field is
 *   told so rather than having it silently dropped, because a silently
 *   dropped field is a caller believing something is in force that isn't.
 */

export const OBJECTIVE_MIN_LENGTH = 12;
export const OBJECTIVE_MAX_LENGTH = 500;

/**
 * The only workspace an objective may name.
 *
 * A single-member enum rather than a boolean or a free string: it reads as
 * a policy with room to grow a second entry under a later authorization,
 * and every other value produces the same structural rejection.
 */
export const OBJECTIVE_WORKSPACES = ["foundry_managed"] as const;
export const ObjectiveWorkspaceSchema = z.enum(OBJECTIVE_WORKSPACES);
export type ObjectiveWorkspace = z.infer<typeof ObjectiveWorkspaceSchema>;

/**
 * Control characters, including tab, newline, and carriage return.
 *
 * The objective is a single sentence of intent shown in one line of the
 * navigator and one timeline row. Multi-line text is not more expressive
 * here; it is a way to smuggle structure past a field that is meant to
 * carry a sentence.
 */
// eslint-disable-next-line no-control-regex -- matching control characters is the entire purpose
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export const ObjectiveTextSchema = z
  .string()
  .trim()
  .min(OBJECTIVE_MIN_LENGTH, {
    message: `Objective must be at least ${OBJECTIVE_MIN_LENGTH} characters — state what should be built.`,
  })
  .max(OBJECTIVE_MAX_LENGTH, {
    message: `Objective must be at most ${OBJECTIVE_MAX_LENGTH} characters. This slice accepts one small, self-contained software artifact, not a project brief.`,
  })
  .refine((value) => !CONTROL_CHARACTERS.test(value), {
    message:
      "Objective must be a single line of printable text (no tabs, newlines, or control characters).",
  });

export const ObjectiveSubmissionSchema = z
  .object({
    objective: ObjectiveTextSchema,
    workspace: ObjectiveWorkspaceSchema,
    riskClass: V1RiskClassSchema,
  })
  .strict();
export type ObjectiveSubmission = z.infer<typeof ObjectiveSubmissionSchema>;
