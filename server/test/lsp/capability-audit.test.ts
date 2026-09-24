import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  CodeActionRequest,
  CompletionRequest,
  DefinitionRequest,
  DocumentFormattingRequest,
  DocumentSymbolRequest,
  HoverRequest,
  InlayHintRequest,
  ReferencesRequest,
  SemanticTokensRequest,
  WorkspaceSymbolRequest,
} from 'vscode-languageserver-protocol/node.js';
import { pathToUri } from '../../src/core/io/UriUtils.js';
import { startTestServer, initialize, openDoc, waitForDiagnostics, settle, TestServer } from './harness.js';

/**
 * What the server sends a client that advertised nothing (plan 1.6).
 *
 * Everything the server initiates -- refresh requests, progress, showDocument,
 * capability registration -- is gated on a client capability. A client that
 * declares none must receive only notifications every client accepts:
 * diagnostics and log messages. The client-profile matrix (plan 3.5)
 * generalises this to real editors' capabilities.
 */

const ALWAYS_ALLOWED = new Set(['textDocument/publishDiagnostics', 'window/logMessage']);

let dir: string;
let server: TestServer | undefined;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pss-audit-'));
  writeFileSync(join(dir, 'pkg.pss'), 'package p {\n    struct data_s { rand bit[32] addr; }\n}\n');
  writeFileSync(join(dir, 'top.pss'), 'import p::*;\ncomponent top_c {\n    data_s cfg;\n    nowhere_s bad;\n}\n');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  server?.dispose();
  server = undefined;
});

describe('capability audit', () => {
  it('sends a minimal client nothing it did not ask for', async () => {
    server = startTestServer();
    await initialize(server, { rootUri: pathToUri(dir) });

    const uri = pathToUri(join(dir, 'top.pss'));
    await waitForDiagnostics(server, uri);
    await openDoc(server, uri, 'import p::*;\ncomponent top_c {\n    data_s cfg;\n    nowhere_s bad;\n}\n');

    const doc = { textDocument: { uri } };
    const at = { ...doc, position: { line: 2, character: 6 } };
    const whole = { start: { line: 0, character: 0 }, end: { line: 5, character: 0 } };
    await server.client.sendRequest(HoverRequest.type, at);
    await server.client.sendRequest(DefinitionRequest.type, at);
    await server.client.sendRequest(ReferencesRequest.type, { ...at, context: { includeDeclaration: true } });
    await server.client.sendRequest(CompletionRequest.type, at);
    await server.client.sendRequest(DocumentSymbolRequest.type, doc);
    await server.client.sendRequest(WorkspaceSymbolRequest.type, { query: 'data' });
    await server.client.sendRequest(SemanticTokensRequest.type, doc);
    await server.client.sendRequest(InlayHintRequest.type, { ...doc, range: whole });
    await server.client.sendRequest(CodeActionRequest.type, { ...doc, range: whole, context: { diagnostics: [] } });
    await server.client.sendRequest(DocumentFormattingRequest.type, {
      ...doc, options: { tabSize: 4, insertSpaces: true },
    });
    await settle(server);

    const unexpected = server.messages.filter(m => m.kind === 'request' || !ALWAYS_ALLOWED.has(m.method));
    expect(unexpected).toEqual([]);
  });
});
