import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  DidChangeWatchedFilesNotification,
  FileChangeType,
  RegistrationParams,
} from 'vscode-languageserver-protocol/node.js';
import { pathToUri } from '../../src/core/io/UriUtils.js';
import {
  startTestServer,
  initialize,
  waitFor,
  waitForDiagnostics,
  settle,
  TestServer,
} from './harness.js';

/**
 * Server-registered file watching (plan 1.5).
 *
 * Only VS Code's extension sets up a watcher of its own. Any other client
 * learns about files created, changed or deleted outside the editor only if
 * the server asks it to watch them, and only a client that supports dynamic
 * registration can be asked.
 */

let dir: string;
let server: TestServer | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pss-watch-'));
  writeFileSync(join(dir, 'a.pss'), 'component a { }\n');
});

afterEach(() => {
  server?.dispose();
  server = undefined;
  rmSync(dir, { recursive: true, force: true });
});

const WATCHING = { workspace: { didChangeWatchedFiles: { dynamicRegistration: true } } };

/** Initialize on `dir` and wait for the startup scan to finish. */
async function start(capabilities: object): Promise<TestServer> {
  const s = startTestServer();
  await initialize(s, { rootUri: pathToUri(dir), capabilities });
  await waitFor(
    () => s.messages.find(m => String((m.params as { message?: string })?.message).includes('[workspace] Indexed')),
    'Workspace scan did not finish',
  );
  return s;
}

function registrations(s: TestServer): RegistrationParams[] {
  return s.messages
    .filter(m => m.kind === 'request' && m.method === 'client/registerCapability')
    .map(m => m.params as RegistrationParams);
}

function notifyWatched(s: TestServer, uri: string, type: FileChangeType) {
  return s.client.sendNotification(DidChangeWatchedFilesNotification.type, { changes: [{ uri, type }] });
}

describe('file watching', () => {
  it('registers a **/*.pss watcher with a client that supports it', async () => {
    server = await start(WATCHING);

    const regs = registrations(server).flatMap(r => r.registrations);
    expect(regs).toHaveLength(1);
    expect(regs[0].method).toBe('workspace/didChangeWatchedFiles');
    expect(regs[0].registerOptions).toEqual({ watchers: [{ globPattern: '**/*.pss' }] });
  });

  it('sends no registration to a client that does not support it', async () => {
    server = await start({});
    await settle(server);
    expect(registrations(server)).toEqual([]);
  });

  it('picks up a created file once, even when the event arrives twice', async () => {
    server = await start(WATCHING);
    const uri = pathToUri(join(dir, 'b.pss'));
    writeFileSync(join(dir, 'b.pss'), 'component b { nowhere_s x; }\n');

    await notifyWatched(server, uri, FileChangeType.Created);
    const published = await waitForDiagnostics(server, uri);
    expect(published.diagnostics.map(d => d.message)).toEqual(["unknown type 'nowhere_s'"]);

    // VS Code's own watcher and the registered one both report the change
    // until Phase 4.3 removes the former.
    await notifyWatched(server, uri, FileChangeType.Created);
    await settle(server);
    expect(server.diagnostics.filter(d => d.uri === uri)).toHaveLength(1);
  });

  it('clears a deleted file once, even when the event arrives twice', async () => {
    server = await start(WATCHING);
    const uri = pathToUri(join(dir, 'a.pss'));
    server.diagnostics.length = 0;
    unlinkSync(join(dir, 'a.pss'));

    await notifyWatched(server, uri, FileChangeType.Deleted);
    await notifyWatched(server, uri, FileChangeType.Deleted);
    await settle(server);

    expect(server.diagnostics.filter(d => d.uri === uri)).toEqual([{ uri, diagnostics: [] }]);
  });
});
