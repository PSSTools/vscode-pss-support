/**
 * An LSP client for a server running as a separate process: the installed
 * `pss-ls` bin over stdio, or the `./server` export forked with Node IPC the
 * way the VS Code extension starts it.
 *
 * Unlike `test/lsp/harness.ts`, nothing here imports the server's sources.
 * The server under test is whatever the tarball installed.
 */
import { spawn, fork, ChildProcess } from 'child_process';
import { join } from 'path';
import {
  createMessageConnection,
  MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  IPCMessageReader,
  IPCMessageWriter,
  PublishDiagnosticsNotification,
  PublishDiagnosticsParams,
} from 'vscode-languageserver-protocol/node.js';

const IS_WINDOWS = process.platform === 'win32';

/** `node_modules/.bin/pss-ls` under `installDir`, as npm linked it. */
export function binPath(installDir: string): string {
  return join(installDir, 'node_modules', '.bin', IS_WINDOWS ? 'pss-ls.cmd' : 'pss-ls');
}

export interface ServerProcess {
  child: ChildProcess;
  connection: MessageConnection;
  diagnostics: PublishDiagnosticsParams[];
  /** Everything the server wrote to stderr so far. */
  stderr(): string;
  /** Resolves with the exit code once the process has exited. */
  exited: Promise<number | null>;
  /**
   * `step`, or a failure carrying stderr if the process exits first. Without
   * this a server that dies on startup only shows up as a test timeout.
   */
  alive<T>(step: Promise<T>): Promise<T>;
  /** Kill the process if it is still running. */
  dispose(): void;
}

function attach(child: ChildProcess, connection: MessageConnection): ServerProcess {
  let stderr = '';
  child.stderr?.setEncoding('utf-8');
  child.stderr?.on('data', (chunk: string) => { stderr += chunk; });

  // 'close', not 'exit': it waits for stderr to drain, so the failure shows why.
  const exited = new Promise<number | null>(resolve => child.on('close', code => resolve(code)));
  const died = exited.then((code): never => {
    throw new Error(`server exited with code ${code} mid-session; stderr:\n${stderr}`);
  });
  died.catch(() => { /* only observed through alive() */ });

  const diagnostics: PublishDiagnosticsParams[] = [];
  connection.onNotification(PublishDiagnosticsNotification.type, params => { diagnostics.push(params); });
  // Acknowledge any server request (e.g. client/registerCapability).
  connection.onRequest(() => null);
  connection.listen();

  return {
    child,
    connection,
    diagnostics,
    stderr: () => stderr,
    exited,
    alive: step => Promise.race([step, died]),
    dispose: () => {
      connection.dispose();
      if (child.exitCode === null && child.signalCode === null) child.kill();
    },
  };
}

/** Run the installed bin with `args`, speaking LSP over its stdin/stdout. */
export function spawnBin(installDir: string, args: string[]): ServerProcess {
  const child = spawn(binPath(installDir), args, {
    cwd: installDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: IS_WINDOWS,
  });
  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout!),
    new StreamMessageWriter(child.stdin!),
  );
  return attach(child, connection);
}

/** Fork `modulePath` with `--node-ipc`, as vscode-languageclient's TransportKind.ipc does. */
export function forkIpc(modulePath: string, cwd: string): ServerProcess {
  const child = fork(modulePath, ['--node-ipc'], { cwd, silent: true });
  const connection = createMessageConnection(new IPCMessageReader(child), new IPCMessageWriter(child));
  return attach(child, connection);
}

/** Poll until `probe` returns a value, or fail with `what` after `timeoutMs`. */
export async function waitFor<T>(probe: () => T | undefined, what: string, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = probe();
    if (found !== undefined) return found;
    if (Date.now() > deadline) throw new Error(`${what} within ${timeoutMs}ms`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

/** Resolve with the exit code, or fail if the process is still running after `timeoutMs`. */
export function exitWithin(server: ServerProcess, timeoutMs: number): Promise<number | null> {
  return Promise.race([
    server.exited,
    new Promise<never>((_, reject) => setTimeout(
      () => reject(new Error(`process still running after ${timeoutMs}ms; stderr:\n${server.stderr()}`)),
      timeoutMs,
    ).unref()),
  ]);
}
