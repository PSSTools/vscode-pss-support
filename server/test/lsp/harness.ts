/**
 * An in-process LSP client wired to a real server over a JSON-RPC connection.
 *
 * The server runs exactly as it does in production -- same handler
 * registration, same protocol framing -- with a pair of in-memory streams
 * standing in for stdio. No VS Code, no extension host, no display.
 *
 * Every message the server sends is recorded, so a test can assert both on
 * what arrived and on what did not: a server must not send a client a request
 * the client never said it could handle.
 */
import { PassThrough } from 'stream';
import {
  createConnection,
  StreamMessageReader,
  StreamMessageWriter,
  ProposedFeatures,
} from 'vscode-languageserver/node.js';
import {
  createMessageConnection,
  InitializeRequest,
  InitializeParams,
  InitializeResult,
  InitializedNotification,
  DidOpenTextDocumentNotification,
  PublishDiagnosticsNotification,
  PublishDiagnosticsParams,
} from 'vscode-languageserver-protocol/node.js';
import { startLanguageServer } from '../../src/lsp/PSSLanguageServer.js';

/** A message the server sent to the client. */
export interface ServerMessage {
  kind: 'request' | 'notification';
  method: string;
  params: unknown;
}

/** A running server plus a client connection speaking to it. */
export function startTestServer() {
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

  // A plain message connection rather than a protocol one: only its type
  // declares the catch-all handlers used to record every server message.
  const client = createMessageConnection(
    new StreamMessageReader(serverToClient),
    new StreamMessageWriter(clientToServer),
  );

  const messages: ServerMessage[] = [];
  const diagnostics: PublishDiagnosticsParams[] = [];

  client.onNotification((method: string, params: unknown) => {
    messages.push({ kind: 'notification', method, params });
    if (method === PublishDiagnosticsNotification.type.method) {
      diagnostics.push(params as PublishDiagnosticsParams);
    }
  });
  // Answer every server request with null, the way a client acknowledges
  // `client/registerCapability` and the like.
  client.onRequest((method: string, params: unknown) => {
    messages.push({ kind: 'request', method, params });
    return null;
  });
  client.listen();

  return {
    client,
    messages,
    diagnostics,
    dispose: () => {
      client.dispose();
      serverConnection.dispose();
    },
  };
}

export type TestServer = ReturnType<typeof startTestServer>;

/** The initialize parameters of a client that advertises nothing and has no workspace. */
export const MINIMAL_INIT: InitializeParams = {
  processId: null,
  rootUri: null,
  capabilities: {},
  workspaceFolders: null,
};

/** Run the initialize handshake; `params` overrides fields of `MINIMAL_INIT`. */
export async function initialize(
  server: TestServer,
  params: Partial<InitializeParams> = {},
): Promise<InitializeResult> {
  const result = await server.client.sendRequest(InitializeRequest.type, { ...MINIMAL_INIT, ...params });
  await server.client.sendNotification(InitializedNotification.type, {});
  return result;
}

export function openDoc(server: TestServer, uri: string, text: string) {
  return server.client.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: { uri, languageId: 'pss', version: 1, text },
  });
}

/** Poll until `probe` returns a value, or fail with `what` after `timeoutMs`. */
export async function waitFor<T>(
  probe: () => T | undefined,
  what: string,
  timeoutMs = 3000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = probe();
    if (found !== undefined) return found;
    if (Date.now() > deadline) throw new Error(`${what} within ${timeoutMs}ms`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/** Wait for a diagnostics notification for `uri`, or time out with a clear message. */
export function waitForDiagnostics(
  server: TestServer,
  uri: string,
  timeoutMs = 3000,
): Promise<PublishDiagnosticsParams> {
  return waitFor(
    () => server.diagnostics.find(d => d.uri === uri),
    `No diagnostics published for ${uri}`,
    timeoutMs,
  );
}

/**
 * Let in-flight messages land. For asserting that something was *not* sent:
 * a round trip through the server orders everything it sent before the reply.
 */
export async function settle(server: TestServer): Promise<void> {
  await server.client.sendRequest('workspace/symbol', { query: '' });
}
