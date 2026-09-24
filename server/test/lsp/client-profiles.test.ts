import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'fs';
import { basename, join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import {
  ClientCapabilities,
  CodeLensRequest,
  CompletionItem,
  CompletionList,
  CompletionRequest,
  CompletionResolveRequest,
  DefinitionRequest,
  Diagnostic,
  DocumentFormattingRequest,
  DocumentSymbolRequest,
  Hover,
  HoverRequest,
  InitializeParams,
  InitializeRequest,
  InitializedNotification,
  ReferencesRequest,
  ShutdownRequest,
  WorkspaceSymbolRequest,
} from 'vscode-languageserver-protocol/node.js';
import { pathToUri } from '../../src/core/io/UriUtils.js';
import { startTestServer, openDoc, waitForDiagnostics, settle, TestServer, ServerMessage } from './harness.js';

/**
 * The client-profile matrix (plan 3.5).
 *
 * Each file in `profiles/` is the `initialize` params of a real client:
 * transcribed from its source, or for VS Code produced by running
 * vscode-languageclient itself, plus a hand-written minimal client. One
 * scenario runs against each, in-process, and checks that the server sent
 * nothing the client did not advertise -- not only no unasked-for requests,
 * but no response shapes, content formats or enum values outside what the
 * client declared. Where a capability is absent, the protocol's default
 * applies (plaintext, flat symbols, the original 18 kinds).
 *
 * Profiles go stale: re-transcribe them when bumping vscode-languageserver or
 * when a client changes what it sends. Each file records its source and date.
 */

interface Profile {
  client: string;
  source: string;
  version: string;
  transcribed: string;
  notes: string;
  params: InitializeParams;
}

const PROFILE_DIR = fileURLToPath(new URL('profiles', import.meta.url));
const profiles = readdirSync(PROFILE_DIR)
  .filter(f => f.endsWith('.json'))
  .sort()
  .map(f => ({ file: f, text: readFileSync(join(PROFILE_DIR, f), 'utf-8') }));

const PKG_TEXT = [
  'package p {',
  '    enum mode_e { FAST, SLOW }',
  '    struct data_s {',
  '        rand bit[32] addr;',
  '        mode_e mode;',
  '    }',
  '}',
  '',
].join('\n');
const TOP_TEXT = [
  'import p::*;',
  'component top_c {',
  '    data_s cfg;',
  '    nowhere_s bad;',
  '    action run_a {',
  '        rand data_s d;',
  '        constraint { d.mode == FAST; }',
  '    }',
  '}',
  '',
].join('\n');

/** The original 18 kinds: what a client that sends no valueSet supports. */
const BASE_KINDS = Array.from({ length: 18 }, (_, i) => i + 1);

let dir: string;
let server: TestServer | undefined;

beforeAll(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'pss-profiles-')));
  writeFileSync(join(dir, 'pkg.pss'), PKG_TEXT);
  writeFileSync(join(dir, 'top.pss'), TOP_TEXT);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  server?.dispose();
  server = undefined;
});

/** The profile, with its workspace placeholders pointed at `dir`. */
function load(text: string): Profile {
  const esc = (s: string) => JSON.stringify(s).slice(1, -1);
  return JSON.parse(text
    .split('file:///WORKSPACE').join(esc(pathToUri(dir)))
    .split('"/WORKSPACE"').join(JSON.stringify(dir))
    .split('"WORKSPACE"').join(JSON.stringify(basename(dir))));
}

/** Everything the scenario saw, for the checks below. */
interface Observed {
  messages: ServerMessage[];
  diagnostics: Diagnostic[];
  hovers: Hover[];
  documentSymbols: unknown[];
  workspaceSymbols: { kind: number }[];
  completions: CompletionItem[];
  definitions: unknown[];
  positionEncoding?: string;
  codeLensProvider: boolean;
  codeLenses: unknown[];
}

async function scenario(s: TestServer, params: InitializeParams): Promise<Observed> {
  const init = await s.client.sendRequest(InitializeRequest.type, params);
  await s.client.sendNotification(InitializedNotification.type, {});

  const topUri = pathToUri(join(dir, 'top.pss'));
  const pkgUri = pathToUri(join(dir, 'pkg.pss'));
  // Arrives from the workspace scan: the profile's root fields were understood.
  await waitForDiagnostics(s, topUri);
  await openDoc(s, topUri, TOP_TEXT);

  const top = { textDocument: { uri: topUri } };
  const pkg = { textDocument: { uri: pkgUri } };
  const onType = { ...top, position: { line: 2, character: 6 } };   // data_s
  const onEnum = { ...top, position: { line: 6, character: 30 } };  // FAST

  const hovers = [
    await s.client.sendRequest(HoverRequest.type, onType),
    await s.client.sendRequest(HoverRequest.type, onEnum),
  ].filter((h): h is Hover => h !== null);
  const definitions = [await s.client.sendRequest(DefinitionRequest.type, onType)].flat().filter(Boolean);
  await s.client.sendRequest(ReferencesRequest.type, { ...onType, context: { includeDeclaration: true } });

  const completions: CompletionItem[] = [];
  for (const position of [{ line: 2, character: 4 }, { line: 6, character: 22 }, { line: 6, character: 30 }]) {
    const list = await s.client.sendRequest(CompletionRequest.type, { ...top, position });
    const items = Array.isArray(list) ? list : (list as CompletionList | null)?.items ?? [];
    completions.push(...items);
  }
  for (const item of completions.slice(0, 5)) {
    completions.push(await s.client.sendRequest(CompletionResolveRequest.type, item));
  }

  const documentSymbols = [
    ...(await s.client.sendRequest(DocumentSymbolRequest.type, pkg) ?? []),
    ...(await s.client.sendRequest(DocumentSymbolRequest.type, top) ?? []),
  ];
  const workspaceSymbols = (await s.client.sendRequest(WorkspaceSymbolRequest.type, { query: '' }) ?? []) as { kind: number }[];
  await s.client.sendRequest(DocumentFormattingRequest.type, { ...top, options: { tabSize: 4, insertSpaces: true } });
  // pkg.pss: data_s is referenced from top.pss, so VS Code gets a lens there.
  const codeLenses = await s.client.sendRequest(CodeLensRequest.type, pkg) ?? [];

  await settle(s);
  await s.client.sendRequest(ShutdownRequest.type);

  return {
    messages: s.messages,
    diagnostics: s.diagnostics.flatMap(d => d.diagnostics),
    hovers,
    documentSymbols,
    workspaceSymbols,
    completions,
    definitions,
    positionEncoding: init.capabilities.positionEncoding,
    codeLensProvider: init.capabilities.codeLensProvider !== undefined,
    codeLenses,
  };
}

/**
 * Everything in `seen` the client with `caps` did not advertise, as readable
 * strings. Empty means the server stayed within the client's capabilities.
 */
function violations(params: InitializeParams, seen: Observed): string[] {
  const caps: ClientCapabilities = params.capabilities;
  const td = caps.textDocument ?? {};
  const out: string[] = [];
  const check = (ok: boolean, what: string) => { if (!ok) out.push(what); };

  // Requests the server sent the client.
  for (const m of seen.messages.filter(m => m.kind === 'request')) {
    if (m.method === 'client/registerCapability') {
      const regs = (m.params as { registrations: { method: string }[] }).registrations;
      for (const r of regs) {
        check(r.method === 'workspace/didChangeWatchedFiles'
          && caps.workspace?.didChangeWatchedFiles?.dynamicRegistration === true,
        `registered ${r.method} without dynamicRegistration`);
      }
    } else if (m.method === 'workspace/configuration') {
      check(caps.workspace?.configuration === true, 'requested workspace/configuration');
    } else if (m.method === 'window/workDoneProgress/create') {
      check(caps.window?.workDoneProgress === true, 'created work-done progress');
    } else {
      out.push(`sent request ${m.method}`);
    }
  }
  // Notifications: diagnostics and messages, which every client takes.
  const notifications = new Set(['textDocument/publishDiagnostics', 'window/logMessage', 'window/showMessage']);
  for (const m of seen.messages.filter(m => m.kind === 'notification')) {
    check(notifications.has(m.method), `sent notification ${m.method}`);
  }

  const pd = td.publishDiagnostics;
  for (const d of seen.diagnostics) {
    check(d.tags === undefined || d.tags.every(t => pd?.tagSupport?.valueSet.includes(t)), `diagnostic tags ${d.tags}`);
    check(d.relatedInformation === undefined || pd?.relatedInformation === true, 'diagnostic relatedInformation');
    check(d.codeDescription === undefined || pd?.codeDescriptionSupport === true, 'diagnostic codeDescription');
    check(d.data === undefined || pd?.dataSupport === true, 'diagnostic data');
  }

  const hoverFormats: string[] = td.hover?.contentFormat ?? ['plaintext'];
  for (const h of seen.hovers) {
    const kind = (h.contents as { kind?: string }).kind;
    check(kind === undefined || hoverFormats.includes(kind), `hover in ${kind}, client takes ${hoverFormats}`);
  }

  const hierarchical = td.documentSymbol?.hierarchicalDocumentSymbolSupport === true;
  const docKinds = td.documentSymbol?.symbolKind?.valueSet ?? BASE_KINDS;
  const walk = (syms: unknown[]) => {
    for (const s of syms as { kind: number; name: string; selectionRange?: unknown; children?: unknown[] }[]) {
      check(hierarchical || s.selectionRange === undefined, `hierarchical document symbol ${s.name}`);
      check(docKinds.includes(s.kind), `document symbol ${s.name} of kind ${s.kind}`);
      walk(s.children ?? []);
    }
  };
  walk(seen.documentSymbols);

  const wsKinds = caps.workspace?.symbol?.symbolKind?.valueSet ?? BASE_KINDS;
  for (const s of seen.workspaceSymbols) check(wsKinds.includes(s.kind), `workspace symbol of kind ${s.kind}`);

  const ci = td.completion?.completionItem;
  const itemKinds = td.completion?.completionItemKind?.valueSet ?? BASE_KINDS;
  const docFormats: string[] = ci?.documentationFormat ?? ['plaintext'];
  for (const c of seen.completions) {
    check(c.kind === undefined || itemKinds.includes(c.kind), `completion ${c.label} of kind ${c.kind}`);
    check(c.insertTextFormat !== 2 || ci?.snippetSupport === true, `snippet completion ${c.label}`);
    const docKind = typeof c.documentation === 'object' ? c.documentation.kind : undefined;
    check(docKind === undefined || docFormats.includes(docKind), `completion documentation in ${docKind}`);
    check(c.labelDetails === undefined || ci?.labelDetailsSupport === true, 'completion labelDetails');
    check(c.tags === undefined || c.tags.every(t => ci?.tagSupport?.valueSet.includes(t)), 'completion tags');
    check(c.textEdit === undefined || !('insert' in c.textEdit) || ci?.insertReplaceSupport === true, 'insert/replace edit');
  }

  for (const d of seen.definitions) {
    check(!('targetUri' in (d as object)) || td.definition?.linkSupport === true, 'LocationLink definition');
  }

  const encodings = caps.general?.positionEncodings ?? ['utf-16'];
  check(seen.positionEncoding === undefined || encodings.includes(seen.positionEncoding),
    `position encoding ${seen.positionEncoding}`);

  // Every lens runs a VS Code command (see ServerInitOptions).
  const vscodeCommands = (params.initializationOptions as { vscodeCommands?: boolean } | undefined)?.vscodeCommands === true;
  check(seen.codeLensProvider === vscodeCommands, `codeLensProvider ${seen.codeLensProvider}`);
  check(vscodeCommands || seen.codeLenses.length === 0, 'code lenses for a client without vscodeCommands');

  return out;
}

describe('client-profile matrix', () => {
  it('has the expected profiles', () => {
    expect(profiles.map(p => p.file)).toEqual(['eglot.json', 'helix.json', 'minimal.json', 'neovim.json', 'vscode.json']);
  });

  for (const { file, text } of profiles) {
    it(`serves ${file} within its capabilities`, async () => {
      const profile = load(text);
      server = startTestServer();
      const seen = await scenario(server, profile.params);

      expect(violations(profile.params, seen)).toEqual([]);

      // The scenario exercised what the checks look at.
      expect(seen.hovers.length).toBeGreaterThan(0);
      expect(seen.completions.length).toBeGreaterThan(0);
      expect(seen.documentSymbols.length).toBeGreaterThan(0);
      expect(seen.definitions.length).toBe(1);

      // Watching files: registered exactly when the client can take it.
      const registered = seen.messages.some(m => m.method === 'client/registerCapability');
      expect(registered).toBe(profile.params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true);
    });
  }

  // Downgrading for a limited client must not cost a capable one anything.
  it('gives VS Code markdown, hierarchical symbols and the full kind range', async () => {
    const profile = load(profiles.find(p => p.file === 'vscode.json')!.text);
    server = startTestServer();
    const seen = await scenario(server, profile.params);

    expect(seen.hovers.every(h => (h.contents as { kind: string }).kind === 'markdown')).toBe(true);
    expect(seen.documentSymbols.some(s => (s as { selectionRange?: unknown }).selectionRange !== undefined)).toBe(true);
    expect(seen.completions.some(c => c.kind !== undefined && c.kind > 18)).toBe(true);
    expect(seen.codeLenses.length).toBeGreaterThan(0);
  });
});
