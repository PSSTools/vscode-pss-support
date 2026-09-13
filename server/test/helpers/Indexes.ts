/**
 * `WorkspaceIndex` construction for tests, with disposal handled centrally.
 *
 * An index owns a WASM parser session, and the WASM heap is outside the reach
 * of the JavaScript garbage collector: dropping the last reference to an index
 * frees the wrapper and leaks the session behind it. The server creates one
 * index for its lifetime, so this never mattered in production, but the test
 * suite built 75 of them and released none -- the parser's finalization
 * registry printed 74 leak warnings on every run.
 *
 * Disposal is registered here rather than written at each site because a test
 * that ends in a failed assertion never reaches its own cleanup, which is
 * exactly when the index is most likely to be holding something interesting.
 * `test/setup.ts` calls `disposeIndexes` after every test, pass or fail.
 */
import { WorkspaceIndex } from '../../src/core/index/WorkspaceIndex.js';

const live: WorkspaceIndex[] = [];

/** A `WorkspaceIndex` that will be disposed when the current test ends. */
export function makeIndex(): WorkspaceIndex {
  const index = new WorkspaceIndex();
  live.push(index);
  return index;
}

/**
 * Adopt an index this module did not build.
 *
 * `WorkspaceLoader.load` constructs its own index and returns it, so there is
 * no factory call to intercept; the caller hands the result here instead.
 */
export function trackIndex(index: WorkspaceIndex): WorkspaceIndex {
  live.push(index);
  return index;
}

/**
 * Dispose every index made since the last call.
 *
 * Safe to call twice: the list is emptied as it is walked. A `dispose()` that
 * throws must not strand the indexes behind it in the list, so failures are
 * collected and re-thrown once at the end.
 */
export function disposeIndexes(): void {
  const failures: unknown[] = [];
  for (const index of live.splice(0)) {
    try {
      index.dispose();
    } catch (e: unknown) {
      failures.push(e);
    }
  }
  if (failures.length > 0) {
    throw failures[0];
  }
}
