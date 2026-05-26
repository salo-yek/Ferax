/**
 * Guards automatic command execution by detecting:
 *  1. Cycle detection — identical command + same non-zero exit code within a
 *     session is blocked from re-executing.
 *  2. Failure halting — non-zero exit codes return a structured error that
 *     signals the AI agent to stop.
 */

export type CommandResult = {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
};

export type GuardResult =
  | { kind: "ok"; result: CommandResult }
  | { kind: "cycle"; lastResult: CommandResult }
  | { kind: "failure"; result: CommandResult };

/**
 * Per-session set of failed commands. Key format: `"command\0exitCode"`.
 * Stored in a module-level WeakMap keyed by session id so it naturally
 * garbage-collects when the session object is collected.
 */
const sessionFailureKeys = new Map<string, Set<string>>();

function failureKey(command: string, exitCode: number | null): string {
  return `${command}\0${exitCode ?? -1}`;
}

/**
 * Check whether the given command was already attempted this session and
 * failed with the same exit code. Register the result if it's new.
 */
export function checkAndRecord(
  sessionId: string,
  command: string,
  result: CommandResult,
): GuardResult {
  let keys = sessionFailureKeys.get(sessionId);
  if (!keys) {
    keys = new Set<string>();
    sessionFailureKeys.set(sessionId, keys);
  }

  const exitCode = result.exit_code;

  // Success — allow and don't record
  if (exitCode === 0) {
    return { kind: "ok", result };
  }

  // Failure — check for cycle
  const key = failureKey(command, exitCode);
  if (keys.has(key)) {
    return { kind: "cycle", lastResult: result };
  }

  // New failure — record and report
  keys.add(key);
  return { kind: "failure", result };
}

/**
 * Clear the failure history for a session (e.g. on new chat).
 */
export function clearSessionHistory(sessionId: string): void {
  sessionFailureKeys.delete(sessionId);
}