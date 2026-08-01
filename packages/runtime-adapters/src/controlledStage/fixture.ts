import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The isolated, disposable fixture repository for FBL-028.
 *
 * Created fresh under the OS temp directory for every run. It is never
 * the Foundry repository, the user's home, `Documents`, another real
 * project, or any directory holding credentials — the controlled stage
 * gets a repository that exists only for the duration of the test and
 * contains nothing but the demo task it is asked to implement.
 *
 * The fixture is deliberately shaped so that **the runtime cannot
 * validate its own work**:
 *
 * - `src/taskStore.js` is the single file the stage is asked to write.
 * - `test/taskStore.test.js` is written *here*, in advance, and pins the
 *   contract exactly. The stage is told not to modify it — and, having
 *   no shell, cannot run it either.
 * - Foundry runs that suite afterwards, through the policy boundary.
 *
 * So success is decided by a test the runtime did not write and could
 * not execute, which is the only way a self-report can be excluded.
 */

/** The single relative path the controlled stage is permitted to modify. */
export const ALLOWED_WRITE_PATHS = ["src/taskStore.js"] as const;

const SPEC = `# Task Store Specification

Implement \`src/taskStore.js\` as an ES module exporting a single named
function \`createTaskStore\`.

## createTaskStore(initialTasks)

- \`initialTasks\` is optional and defaults to an empty array.
- When provided, it is an array of previously serialized task objects
  (the output of \`toJSON()\`), and the returned store must contain
  exactly those tasks, in the same order. This is how persistence
  round-trips.
- Returns a store object with the methods below.

## Task shape

Every task is an object with:

- \`id\` — a non-empty string, unique within the store
- \`title\` — the trimmed title string
- \`completed\` — boolean
- \`createdAt\` — an ISO 8601 timestamp string

## store.addTask(title)

- Trims \`title\`. If \`title\` is not a string, or is empty after
  trimming, throw \`new Error("title is required")\`.
- Appends a new task with \`completed: false\` and returns it.

## store.completeTask(id)

- Sets \`completed\` to \`true\` for the task with that id and returns it.
- If no task has that id, throw \`new Error("task not found: " + id)\`.

## store.deleteTask(id)

- Removes the task with that id and returns \`true\`.
- If no task has that id, throw \`new Error("task not found: " + id)\`.

## store.listTasks()

- Returns the tasks in insertion order.
- Mutating the returned array must not affect the store's own state.

## store.toJSON()

- Returns a plain array of task objects suitable for
  \`JSON.stringify\`, and accepted by \`createTaskStore\`.
`;

const TESTS = `import assert from "node:assert/strict";
import { test } from "node:test";
import { createTaskStore } from "../src/taskStore.js";

test("addTask returns a well-formed task", () => {
  const store = createTaskStore();
  const task = store.addTask("Write the backend");

  assert.equal(typeof task.id, "string");
  assert.ok(task.id.length > 0);
  assert.equal(task.title, "Write the backend");
  assert.equal(task.completed, false);
  assert.ok(!Number.isNaN(Date.parse(task.createdAt)));
});

test("addTask trims the title", () => {
  const store = createTaskStore();
  assert.equal(store.addTask("   padded   ").title, "padded");
});

test("addTask rejects an empty or non-string title", () => {
  const store = createTaskStore();
  for (const bad of ["", "   ", null, undefined, 42, {}]) {
    assert.throws(() => store.addTask(bad), { message: "title is required" });
  }
});

test("task ids are unique", () => {
  const store = createTaskStore();
  const ids = new Set();
  for (let i = 0; i < 50; i += 1) {
    ids.add(store.addTask("task " + i).id);
  }
  assert.equal(ids.size, 50);
});

test("listTasks preserves insertion order", () => {
  const store = createTaskStore();
  store.addTask("first");
  store.addTask("second");
  store.addTask("third");

  assert.deepEqual(
    store.listTasks().map((task) => task.title),
    ["first", "second", "third"],
  );
});

test("listTasks does not expose the store's own array", () => {
  const store = createTaskStore();
  store.addTask("only");
  const listed = store.listTasks();
  listed.push({ id: "injected" });

  assert.equal(store.listTasks().length, 1);
});

test("completeTask marks the task complete", () => {
  const store = createTaskStore();
  const task = store.addTask("finish me");
  const completed = store.completeTask(task.id);

  assert.equal(completed.completed, true);
  assert.equal(store.listTasks()[0].completed, true);
});

test("completeTask throws for an unknown id", () => {
  const store = createTaskStore();
  assert.throws(() => store.completeTask("nope"), { message: "task not found: nope" });
});

test("deleteTask removes the task and returns true", () => {
  const store = createTaskStore();
  const keep = store.addTask("keep");
  const remove = store.addTask("remove");

  assert.equal(store.deleteTask(remove.id), true);
  assert.deepEqual(
    store.listTasks().map((task) => task.id),
    [keep.id],
  );
});

test("deleteTask throws for an unknown id", () => {
  const store = createTaskStore();
  assert.throws(() => store.deleteTask("nope"), { message: "task not found: nope" });
});

test("toJSON round-trips through createTaskStore", () => {
  const store = createTaskStore();
  const first = store.addTask("persisted one");
  store.addTask("persisted two");
  store.completeTask(first.id);

  const restored = createTaskStore(JSON.parse(JSON.stringify(store.toJSON())));

  assert.deepEqual(restored.toJSON(), store.toJSON());
  assert.equal(restored.listTasks()[0].completed, true);
  assert.equal(restored.listTasks().length, 2);
});

test("a restored store keeps working", () => {
  const store = createTaskStore();
  store.addTask("original");

  const restored = createTaskStore(store.toJSON());
  const added = restored.addTask("added after restore");

  assert.equal(restored.listTasks().length, 2);
  assert.equal(added.completed, false);
});
`;

const STUB = `// Implement this module against ../SPEC.md.
//
// Foundry runs test/taskStore.test.js independently after this stage
// finishes. Do not modify the tests.

export function createTaskStore(initialTasks = []) {
  throw new Error("not implemented");
}
`;

export const TASK_SPECIFICATION = `Implement the task store for this repository.

Read SPEC.md and test/taskStore.test.js, then write the complete
implementation into src/taskStore.js so that it satisfies the
specification exactly.

Rules:
- Modify only src/taskStore.js. Do not create, edit, or delete any other
  file, including the tests.
- Write plain ES module JavaScript. Do not add dependencies.
- The tests will be run independently after you finish. You cannot run
  them yourself.

When src/taskStore.js is complete, reply with a one-line summary.`;

export interface Fixture {
  /** Absolute path to the freshly created repository. */
  root: string;
  /** Relative paths the stage is permitted to modify. */
  allowedWritePaths: readonly string[];
  taskSpecification: string;
}

/**
 * Creates the fixture repository. Returns its absolute path; the caller
 * is responsible for removing it once evidence has been captured.
 */
export function createFixtureRepository(): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "foundry-fbl028-"));

  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(path.join(root, "test"), { recursive: true });

  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "foundry-fbl028-task-store",
        version: "0.0.0",
        private: true,
        type: "module",
        description:
          "Isolated, disposable fixture for the FBL-028 controlled Claude Code stage. Not part of the Foundry workspace.",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(path.join(root, "SPEC.md"), SPEC, "utf8");
  writeFileSync(path.join(root, "test", "taskStore.test.js"), TESTS, "utf8");
  writeFileSync(path.join(root, "src", "taskStore.js"), STUB, "utf8");

  return {
    root,
    allowedWritePaths: ALLOWED_WRITE_PATHS,
    taskSpecification: TASK_SPECIFICATION,
  };
}
