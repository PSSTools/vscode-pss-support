import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  DefinitionRequest,
  DocumentFormattingRequest,
  InitializeParams,
  Location,
  TextEdit,
} from 'vscode-languageserver-protocol/node.js';
import { pathToUri } from '../../src/core/io/UriUtils.js';
import { workspaceRoots } from '../../src/lsp/InitParams.js';
import {
  startTestServer,
  initialize,
  openDoc,
  waitFor,
  waitForDiagnostics,
  MINIMAL_INIT,
  TestServer,
} from './harness.js';

/**
 * Where the server finds its workspace (plan 1.3).
 *
 * VS Code sends `workspaceFolders`. Neovim, eglot and Helix commonly send only
 * `rootUri`, and any of them can open a lone file with no root. Before this
 * fallback, every client but VS Code got no workspace scan and no
 * `.pssconfig.json`.
 */

const PKG_TEXT = 'package p {\n    struct data_s { rand bit[32] addr; }\n}\n';
const TOP_TEXT = 'import p::*;\ncomponent top_c {\n    data_s cfg;\n    nowhere_s bad;\n}\n';

let dir: string;
let rootUri: string;
let topUri: string;
let pkgUri: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pss-roots-'));
  writeFileSync(join(dir, 'pkg.pss'), PKG_TEXT);
  writeFileSync(join(dir, 'top.pss'), TOP_TEXT);
  // indentSize 2 is visible in formatting output; the default is 4.
  writeFileSync(join(dir, '.pssconfig.json'), JSON.stringify({ format: { indentSize: 2 } }));
  rootUri = pathToUri(dir);
  topUri = pathToUri(join(dir, 'top.pss'));
  pkgUri = pathToUri(join(dir, 'pkg.pss'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let server: TestServer | undefined;

afterEach(() => {
  server?.dispose();
  server = undefined;
});

describe('workspaceRoots', () => {
  const base: InitializeParams = MINIMAL_INIT;

  it('prefers workspaceFolders', () => {
    expect(workspaceRoots({
      ...base,
      rootUri: 'file:///other',
      workspaceFolders: [{ uri: 'file:///a', name: 'a' }, { uri: 'file:///b', name: 'b' }],
    })).toEqual(['file:///a', 'file:///b']);
  });

  it('falls back to rootUri when there are no folders', () => {
    expect(workspaceRoots({ ...base, rootUri: 'file:///r' })).toEqual(['file:///r']);
    expect(workspaceRoots({ ...base, rootUri: 'file:///r', workspaceFolders: [] })).toEqual(['file:///r']);
  });

  it('falls back to the deprecated rootPath last', () => {
    expect(workspaceRoots({ ...base, rootPath: '/p' })).toEqual([pathToUri('/p')]);
  });

  it('is empty with no root at all', () => {
    expect(workspaceRoots(base)).toEqual([]);
  });

  it('drops roots the loader cannot read', () => {
    expect(workspaceRoots({
      ...base,
      workspaceFolders: [{ uri: 'vscode-vfs://github/x', name: 'x' }, { uri: 'file:///a', name: 'a' }],
    })).toEqual(['file:///a']);
  });
});

describe('workspace root over the protocol', () => {
  const rooted: Array<[string, () => Partial<InitializeParams>]> = [
    ['workspaceFolders', () => ({ workspaceFolders: [{ uri: rootUri, name: 'ws' }] })],
    ['rootUri only', () => ({ rootUri })],
    ['rootPath only', () => ({ rootPath: dir })],
  ];

  it.each(rooted)('%s: indexes the workspace and reads .pssconfig.json', async (_name, params) => {
    server = startTestServer();
    await initialize(server, params());

    // Diagnostics for a file nobody opened can only come from the scan.
    const published = await waitForDiagnostics(server, topUri);
    expect(published.diagnostics.map(d => d.message)).toEqual(["unknown type 'nowhere_s'"]);

    // Cross-file definition into a file that was never opened.
    await openDoc(server, topUri, TOP_TEXT);
    const result = await server.client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: topUri },
      position: { line: 2, character: 6 },
    }) as Location[];
    expect(result[0]?.uri).toBe(pkgUri);

    const edits = await server.client.sendRequest(DocumentFormattingRequest.type, {
      textDocument: { uri: topUri },
      options: { tabSize: 4, insertSpaces: true },
    }) as TextEdit[];
    expect(edits.map(e => e.newText).join('')).toContain('\n  data_s cfg;');
  });

  it('no root: serves an opened file on its own', async () => {
    server = startTestServer();
    await initialize(server);

    await waitFor(
      () => server!.messages.find(m => String((m.params as { message?: string })?.message)
        .includes('No workspace root')),
      'No single-file-mode log message',
    );

    await openDoc(server, topUri, TOP_TEXT);
    const published = await waitForDiagnostics(server, topUri);
    // Nothing was scanned, so `data_s` from the unopened pkg.pss is unknown too.
    const messages = published.diagnostics.map(d => d.message);
    expect(messages).toContain("unknown type 'data_s'");
    expect(messages).toContain("unknown type 'nowhere_s'");
    expect(server.diagnostics.some(d => d.uri === pkgUri)).toBe(false);
  });
});
