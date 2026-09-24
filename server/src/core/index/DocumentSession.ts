import { WorkspaceIndex } from './WorkspaceIndex.js';
import { Diagnostic } from '../types/Diagnostic.js';

export type TimerHandle = unknown;

/**
 * Timer seam. Production passes the global setTimeout/clearTimeout; tests pass a
 * FakeTimer and step it, so debounce behaviour is verifiable without sleeping.
 */
export interface ITimer {
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const realTimer: ITimer = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface DocumentSessionOptions {
  /** Milliseconds to wait after the last edit before re-parsing. */
  debounceMs?: number;
  timer?: ITimer;
  /** Called whenever a file's diagnostics change. */
  onDiagnostics?: (uri: string, diagnostics: Diagnostic[]) => void;
  /** Called when analysis throws; the session itself never propagates. */
  onError?: (uri: string, error: Error) => void;
  /** Called for trace logging. */
  onLog?: (message: string) => void;
}

/**
 * Owns the open-document lifecycle: debounced re-parsing, on-demand flushing
 * before a request is answered, and diagnostic publication for a file and its
 * dependents.
 *
 * This lived at the top level of server.ts, which made the whole
 * edit-then-query-immediately class of bug -- where a request is answered from
 * an AST that predates the user's last keystroke -- structurally untestable.
 */
export class DocumentSession {
  private index: WorkspaceIndex;
  private debounceMs: number;
  private timer: ITimer;
  private onDiagnostics?: (uri: string, diagnostics: Diagnostic[]) => void;
  private onError?: (uri: string, error: Error) => void;
  private onLog?: (message: string) => void;

  /** Pending debounce timers, keyed by URI. */
  private pendingTimers = new Map<string, TimerHandle>();
  /** Latest text seen for a URI, whether or not it has been parsed yet. */
  private pendingText = new Map<string, string>();
  /** URIs currently open in an editor. */
  private openUris = new Set<string>();

  constructor(index: WorkspaceIndex, options: DocumentSessionOptions = {}) {
    this.index = index;
    this.debounceMs = options.debounceMs ?? 300;
    this.timer = options.timer ?? realTimer;
    this.onDiagnostics = options.onDiagnostics;
    this.onError = options.onError;
    this.onLog = options.onLog;
  }

  /** A document was opened or its content changed. Schedules a debounced parse. */
  didChangeContent(uri: string, text: string): void {
    this.openUris.add(uri);
    this.pendingText.set(uri, text);

    const existing = this.pendingTimers.get(uri);
    if (existing !== undefined) this.timer.clearTimeout(existing);

    this.pendingTimers.set(uri, this.timer.setTimeout(() => {
      this.pendingTimers.delete(uri);
      this.applyPending(uri);
    }, this.debounceMs));
  }

  /**
   * Guarantee the index reflects everything seen for `uri`, parsing now if a
   * debounce is still pending. Request handlers call this before reading.
   */
  ensureParsed(uri: string): void {
    // Every pending document is flushed, not just the requested one. PSS
    // resolution is cross-file: a definition in top.pss can live in pkg.pss, so
    // answering from a half-parsed workspace silently returns nothing. Parsing
    // is the cheap half here anyway -- any edit already invalidates the whole
    // analysis, so the analyzer re-runs regardless of how many files we flush.
    this.flushAll();

    if (!this.index.getAST(uri) && this.pendingText.has(uri)) {
      this.log(`[ensureParsed] initial parse for ${uri}`);
      this.applyPending(uri);
    }
  }

  /** Flush every pending edit. */
  flushAll(): void {
    for (const uri of [...this.pendingTimers.keys()]) {
      const pending = this.pendingTimers.get(uri);
      if (pending !== undefined) this.timer.clearTimeout(pending);
      this.pendingTimers.delete(uri);
      this.log(`[flush] applying pending edits for ${uri}`);
      this.applyPending(uri);
    }
  }

  /** A document was closed. Drops it from the index and clears its squiggles. */
  didClose(uri: string): void {
    const pending = this.pendingTimers.get(uri);
    if (pending !== undefined) this.timer.clearTimeout(pending);
    this.pendingTimers.delete(uri);
    this.pendingText.delete(uri);
    this.openUris.delete(uri);
    this.index.removeFile(uri);
    this.onDiagnostics?.(uri, []);
  }

  /** A .pss file was created or changed on disk. */
  didChangeOnDisk(uri: string, text: string): void {
    // An open buffer is the authority for its own file; disk is stale by
    // definition while the user is typing into it.
    if (this.openUris.has(uri)) return;
    // Watcher events can arrive twice for one change (VS Code's own watcher
    // and the one the server registers), so an unchanged file is a no-op.
    if (this.index.getText(uri) === text) return;
    this.writeToIndex(uri, text);
    this.publish(uri);
  }

  /** A .pss file was deleted from disk. */
  didDeleteOnDisk(uri: string): void {
    // A repeated delete finds nothing to remove; see didChangeOnDisk.
    if (this.index.getText(uri) === undefined && !this.pendingText.has(uri)) return;
    this.index.removeFile(uri);
    this.pendingText.delete(uri);
    this.onDiagnostics?.(uri, []);
  }

  /** True if an edit for this URI has been received but not yet parsed. */
  hasPendingEdits(uri: string): boolean {
    return this.pendingTimers.has(uri);
  }

  // -- internals -------------------------------------------------------

  private applyPending(uri: string): void {
    const text = this.pendingText.get(uri);
    if (text === undefined) return;

    // Capture dependents *before* the edit as well as after. The dependency
    // graph is built from references that resolved, so an edit that breaks a
    // dependency also deletes the edge pointing at the file that just broke --
    // and the dependent would never be re-diagnosed. Publishing the union is
    // what makes an error appear in top.pss when pkg.pss loses a type.
    const before = this.index.getDependents(uri);

    this.writeToIndex(uri, text);
    this.publish(uri);
    this.publishDependents(uri, before);
  }

  private writeToIndex(uri: string, text: string): void {
    if (this.index.getAST(uri)) {
      this.index.updateFile(uri, text);
    } else {
      this.index.addFile(uri, text);
    }
  }

  private publish(uri: string): void {
    if (!this.onDiagnostics) return;
    try {
      this.onDiagnostics(uri, this.index.getDiagnostics(uri));
    } catch (e: unknown) {
      this.onError?.(uri, e instanceof Error ? e : new Error(String(e)));
    }
  }

  private publishDependents(uri: string, alsoPublish: string[] = []): void {
    if (!this.onDiagnostics) return;
    try {
      const targets = new Set([...alsoPublish, ...this.index.getDependents(uri)]);
      targets.delete(uri);   // already published on its own
      for (const depUri of targets) {
        if (!this.index.getAST(depUri)) continue;
        this.onDiagnostics(depUri, this.index.getDiagnostics(depUri));
      }
    } catch (e: unknown) {
      this.onError?.(uri, e instanceof Error ? e : new Error(String(e)));
    }
  }

  private log(message: string): void {
    this.onLog?.(message);
  }
}
