import { describe, it, expect, afterEach } from 'vitest';
import { CodeLens, CodeLensRequest } from 'vscode-languageserver-protocol/node.js';
import { serverInitOptions } from '../../src/lsp/InitParams.js';
import { startTestServer, initialize, openDoc, waitForDiagnostics, TestServer } from './harness.js';

/**
 * `initializationOptions` (plan 1.4). The server's code lenses run commands
 * only VS Code has, so they are offered only to a client that says it can run
 * them; any other editor would show lenses that fail when clicked.
 */

const URI = 'file:///ws/t.pss';
// A reference, a supertype and an activity: one lens of each kind.
const TEXT = [
  'struct base_s { }',
  'struct child_s : base_s { }',
  'component c {',
  '  action a {',
  '    rand child_s d;',
  '    activity { }',
  '  }',
  '}',
].join('\n');

let server: TestServer | undefined;

afterEach(() => {
  server?.dispose();
  server = undefined;
});

async function lenses(s: TestServer): Promise<CodeLens[]> {
  await openDoc(s, URI, TEXT);
  // Let the parse land first. Without the flag the request returns before
  // flushing pending edits, and a parse timer that fires after the test has
  // disposed the connection is an unhandled error.
  await waitForDiagnostics(s, URI);
  return await s.client.sendRequest(CodeLensRequest.type, { textDocument: { uri: URI } }) ?? [];
}

describe('serverInitOptions', () => {
  it.each([undefined, null, 'x', 42, [], {}, { vscodeCommands: 'yes' }, { other: true }])(
    'defaults to editor-neutral for %j', raw => {
      expect(serverInitOptions(raw)).toEqual({ vscodeCommands: false });
    });

  it('reads vscodeCommands: true', () => {
    expect(serverInitOptions({ vscodeCommands: true, other: 1 })).toEqual({ vscodeCommands: true });
  });
});

describe('code lenses and vscodeCommands', () => {
  it('neither advertises nor returns lenses without the flag', async () => {
    server = startTestServer();
    const result = await initialize(server);
    expect(result.capabilities.codeLensProvider).toBeUndefined();

    // A client may ask anyway; it must not get a VS Code command back.
    const got = await lenses(server);
    for (const lens of got) {
      expect(lens.command?.command ?? '').not.toMatch(/^(editor\.action\.|pss\.)/);
    }
    expect(got).toEqual([]);
  });

  it('advertises and returns all three kinds with the flag', async () => {
    server = startTestServer();
    const result = await initialize(server, { initializationOptions: { vscodeCommands: true } });
    expect(result.capabilities.codeLensProvider).toEqual({ resolveProvider: false });

    const commands = new Set((await lenses(server)).map(l => l.command?.command));
    expect(commands).toEqual(new Set([
      'editor.action.findReferences',
      'editor.action.goToTypeDefinition',
      'pss.showActivityDiagram',
    ]));
  });
});
