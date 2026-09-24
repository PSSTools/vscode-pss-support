import { describe, it, expect, afterEach } from 'vitest';
import {
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DefinitionRequest,
  HoverRequest,
  DocumentSymbolRequest,
  CompletionRequest,
  WorkspaceSymbolRequest,
  DocumentFormattingRequest,
  SemanticTokensRequest,
  ShutdownRequest,
  ExitNotification,
  Location,
  Hover,
  DocumentSymbol,
  CompletionList,
  SymbolInformation,
  TextEdit,
  SemanticTokens,
} from 'vscode-languageserver-protocol/node.js';
import {
  startTestServer,
  initialize,
  openDoc,
  waitForDiagnostics,
  TestServer,
} from './harness.js';

/**
 * End-to-end test over a real JSON-RPC connection (see `harness.ts`).
 *
 * This is the only level at which registration mistakes are visible: a handler
 * wired to the wrong request, a capability advertised but not implemented, or a
 * response shape the protocol layer rejects. Unit tests structurally cannot
 * catch those, because they call the handler directly.
 */

const TOP_URI = 'file:///ws/top.pss';
const PKG_URI = 'file:///ws/pkg.pss';

const PKG_TEXT = 'package p {\n    struct data_s {\n        rand bit[32] addr;\n    }\n}';
const TOP_TEXT = 'import p::*;\ncomponent top_c {\n    data_s cfg;\n}';

let server: TestServer | undefined;

afterEach(() => {
  server?.dispose();
  server = undefined;
});

describe('LSP protocol', () => {
  it('advertises the capabilities the client relies on', async () => {
    server = startTestServer();
    const result = await initialize(server);
    const caps = result.capabilities;

    expect(caps.definitionProvider).toBe(true);
    expect(caps.hoverProvider).toBe(true);
    expect(caps.referencesProvider).toBe(true);
    expect(caps.documentSymbolProvider).toBe(true);
    expect(caps.workspaceSymbolProvider).toBe(true);
    expect(caps.renameProvider).toEqual({ prepareProvider: true });
    expect(caps.codeActionProvider).toBe(true);
    expect(caps.documentFormattingProvider).toBe(true);
    expect(caps.completionProvider?.triggerCharacters).toContain('.');
    expect(caps.semanticTokensProvider).toBeDefined();
  });

  it('publishes diagnostics for an opened document', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, TOP_URI, 'component top {\n    nowhere_s x;\n}');

    const published = await waitForDiagnostics(server, TOP_URI);
    expect(published.diagnostics.length).toBeGreaterThan(0);
    expect(published.diagnostics[0].message).toContain('nowhere_s');
    expect(published.diagnostics[0].source).toBe('pss');
  });

  it('answers textDocument/definition across two open documents', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, PKG_URI, PKG_TEXT);
    await openDoc(server, TOP_URI, TOP_TEXT);

    const result = await server.client.sendRequest(DefinitionRequest.type, {
      textDocument: { uri: TOP_URI },
      position: { line: 2, character: 6 },
    }) as Location[];

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].uri).toBe(PKG_URI);
    expect(result[0].range.start.line).toBe(1);
  });

  it('answers textDocument/hover', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, TOP_URI, TOP_TEXT);

    const hover = await server.client.sendRequest(HoverRequest.type, {
      textDocument: { uri: TOP_URI },
      position: { line: 1, character: 12 },
    }) as Hover | null;

    expect(hover).not.toBeNull();
    expect(JSON.stringify(hover!.contents)).toContain('top_c');
  });

  it('answers textDocument/documentSymbol with a nested tree', async () => {
    server = startTestServer();
    // A client that takes a tree; one that does not gets a flat list
    // (client-profiles.test.ts).
    await initialize(server, {
      capabilities: { textDocument: { documentSymbol: { hierarchicalDocumentSymbolSupport: true } } },
    });
    await openDoc(server, PKG_URI, PKG_TEXT);

    const symbols = await server.client.sendRequest(DocumentSymbolRequest.type, {
      textDocument: { uri: PKG_URI },
    }) as DocumentSymbol[];

    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols[0].name).toBe('p');
    expect(symbols[0].children?.[0].name).toBe('data_s');
  });

  it('answers textDocument/completion', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, PKG_URI, PKG_TEXT);
    await openDoc(server, TOP_URI, 'component top {\n    p::\n}');

    const result = await server.client.sendRequest(CompletionRequest.type, {
      textDocument: { uri: TOP_URI },
      position: { line: 1, character: 7 },
    }) as CompletionList;

    expect(result.items.map(i => i.label)).toContain('data_s');
  });

  it('answers workspace/symbol with navigable locations', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, PKG_URI, PKG_TEXT);

    const symbols = await server.client.sendRequest(WorkspaceSymbolRequest.type, {
      query: 'data_s',
    }) as SymbolInformation[];

    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols[0].location.uri).toBe(PKG_URI);
  });

  it('answers textDocument/semanticTokens/full with a well-formed array', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, PKG_URI, PKG_TEXT);

    const tokens = await server.client.sendRequest(SemanticTokensRequest.type, {
      textDocument: { uri: PKG_URI },
    }) as SemanticTokens;

    expect(tokens.data.length % 5).toBe(0);
    expect(tokens.data.length).toBeGreaterThan(0);
  });

  it('answers textDocument/formatting', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, TOP_URI, 'component c {\n int a;\n}');

    const edits = await server.client.sendRequest(DocumentFormattingRequest.type, {
      textDocument: { uri: TOP_URI },
      options: { tabSize: 4, insertSpaces: true },
    }) as TextEdit[];

    expect(edits.length).toBeGreaterThan(0);
    expect(edits[0].newText).toContain('    int a;');
  });

  it('reflects an edit in the very next request', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, TOP_URI, 'component top {\n}');

    await server.client.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri: TOP_URI, version: 2 },
      contentChanges: [{ text: 'component renamed_top {\n}' }],
    });

    const symbols = await server.client.sendRequest(DocumentSymbolRequest.type, {
      textDocument: { uri: TOP_URI },
    }) as DocumentSymbol[];

    // Guards the stale-AST bug: the request must see the edit, not the
    // pre-edit parse.
    expect(symbols[0].name).toBe('renamed_top');
  });

  it('clears diagnostics when a document is closed', async () => {
    server = startTestServer();
    await initialize(server);
    await openDoc(server, TOP_URI, 'component top {\n    nowhere_s x;\n}');
    await waitForDiagnostics(server, TOP_URI);

    server.diagnostics.length = 0;
    await server.client.sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: { uri: TOP_URI },
    });

    const cleared = await waitForDiagnostics(server, TOP_URI);
    expect(cleared.diagnostics).toEqual([]);
  });

  it('shuts down cleanly', async () => {
    server = startTestServer();
    await initialize(server);

    await expect(server.client.sendRequest(ShutdownRequest.type)).resolves.toBeNull();
    await server.client.sendNotification(ExitNotification.type);
  });
});
