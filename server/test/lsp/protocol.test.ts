import { describe, it, expect, afterEach } from 'vitest';
import { PassThrough } from 'stream';
import {
  createConnection,
  StreamMessageReader,
  StreamMessageWriter,
  ProposedFeatures,
} from 'vscode-languageserver/node.js';
import {
  createProtocolConnection,
  InitializeRequest,
  InitializedNotification,
  DidOpenTextDocumentNotification,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DefinitionRequest,
  HoverRequest,
  DocumentSymbolRequest,
  CompletionRequest,
  WorkspaceSymbolRequest,
  PublishDiagnosticsNotification,
  DocumentFormattingRequest,
  SemanticTokensRequest,
  ShutdownRequest,
  ExitNotification,
  Location,
  Hover,
  DocumentSymbol,
  CompletionList,
  SymbolInformation,
  PublishDiagnosticsParams,
  TextEdit,
  SemanticTokens,
} from 'vscode-languageserver-protocol/node.js';
import { startLanguageServer } from '../../src/lsp/PSSLanguageServer.js';

/**
 * End-to-end test over a real JSON-RPC connection.
 *
 * The server runs exactly as it does in production -- same handler
 * registration, same protocol framing -- with a pair of in-memory streams
 * standing in for stdio. No VS Code, no extension host, no display.
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

/** A running server plus a client connection speaking to it. */
function startTestServer() {
  const clientToServer = new PassThrough();
  const serverToClient = new PassThrough();

  const serverConnection = createConnection(
    ProposedFeatures.all,
    new StreamMessageReader(clientToServer),
    new StreamMessageWriter(serverToClient),
  );
  // debounceMs 0 keeps edits synchronous so the test does not race the timer.
  startLanguageServer(serverConnection, { debounceMs: 0 });
  serverConnection.listen();

  const client = createProtocolConnection(
    new StreamMessageReader(serverToClient),
    new StreamMessageWriter(clientToServer),
  );
  client.listen();

  const diagnostics: PublishDiagnosticsParams[] = [];
  client.onNotification(PublishDiagnosticsNotification.type, params => {
    diagnostics.push(params);
  });

  return {
    client,
    diagnostics,
    dispose: () => {
      client.dispose();
      serverConnection.dispose();
    },
  };
}

type TestServer = ReturnType<typeof startTestServer>;

async function initialize(server: TestServer) {
  const result = await server.client.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null,
  });
  await server.client.sendNotification(InitializedNotification.type, {});
  return result;
}

function openDoc(server: TestServer, uri: string, text: string) {
  return server.client.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: { uri, languageId: 'pss', version: 1, text },
  });
}

/** Wait for a diagnostics notification for `uri`, or time out with a clear message. */
async function waitForDiagnostics(
  server: TestServer,
  uri: string,
  timeoutMs = 3000,
): Promise<PublishDiagnosticsParams> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = server.diagnostics.find(d => d.uri === uri);
    if (found) return found;
    if (Date.now() > deadline) {
      throw new Error(`No diagnostics published for ${uri} within ${timeoutMs}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

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
    await initialize(server);
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
