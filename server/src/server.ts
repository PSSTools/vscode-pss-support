import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  DocumentSymbolParams,
  HoverParams,
  DefinitionParams,
  ReferenceParams,
  CompletionParams,
  CompletionItem,
  SignatureHelpParams,
  SemanticTokensParams,
  FoldingRangeParams,
  WorkspaceSymbolParams,
  RenameParams,
  PrepareRenameParams,
  CodeActionParams,
  CallHierarchyPrepareParams,
  CallHierarchyIncomingCallsParams,
  CallHierarchyOutgoingCallsParams,
  TypeHierarchyPrepareParams,
  TypeHierarchySupertypesParams,
  TypeHierarchySubtypesParams,
  InlayHintParams,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  CodeLensParams,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { WorkspaceIndex } from './core/index/WorkspaceIndex';
import { handleDocumentSymbol } from './lsp/LspSymbolHandler';
import { handleHover } from './lsp/LspHoverHandler';
import { handleDefinition } from './lsp/LspDefinitionHandler';
import { handleReferences } from './lsp/LspReferencesHandler';
import { handleCompletion, handleCompletionResolve } from './lsp/LspCompletionHandler';
import { handleSignatureHelp } from './lsp/LspSignatureHelpHandler';
import { handleSemanticTokensFull, SEMANTIC_TOKENS_LEGEND } from './lsp/LspSemanticTokensHandler';
import { handleFoldingRanges } from './lsp/LspFoldingHandler';
import { handlePrepareRename, handleRename } from './lsp/LspRenameHandler';
import { handleCodeAction } from './lsp/LspCodeActionHandler';
import { handlePrepareCallHierarchy, handleIncomingCalls, handleOutgoingCalls } from './lsp/LspCallHierarchyHandler';
import { handlePrepareTypeHierarchy, handleSupertypes, handleSubtypes } from './lsp/LspTypeHierarchyHandler';
import { handleInlayHints } from './lsp/LspInlayHintHandler';
import { convertDiagnostic, convertSymbolKind } from './lsp/LspTypeConverters';
import { handleFormatting, handleRangeFormatting } from './lsp/LspFormattingHandler';
import { handleCodeLens } from './lsp/LspCodeLensHandler';
import { lint } from './core/services/LintService';
import { getWorkspaceSymbols } from './core/services/SymbolService';
import { GlobalScope, ActivityDecl } from './core/ast/generated';
import * as fs from 'fs';
import * as nodePath from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ActivityDiagramBuilder } from './core/diagram/ActivityDiagramBuilder';
import { walkScope, getNodeName } from './core/ast/ASTUtils';

const connection = createConnection(ProposedFeatures.all);
let initParams: InitializeParams;
const documents = new TextDocuments(TextDocument);
const index = new WorkspaceIndex();

connection.onInitialize((params: InitializeParams) => {
  initParams = params;
  connection.console.info('PSS Language Server initializing');

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentSymbolProvider: true,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', ':', '@', '<'],
      },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ['(', ','],
      },
      semanticTokensProvider: {
        legend: SEMANTIC_TOKENS_LEGEND,
        full: true,
      },
      foldingRangeProvider: true,
      workspaceSymbolProvider: true,
      renameProvider: { prepareProvider: true },
      codeActionProvider: true,
      callHierarchyProvider: true,
      typeHierarchyProvider: true,
      inlayHintProvider: true,
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      codeLensProvider: { resolveProvider: false },
    },
  };
  connection.console.info('PSS Language Server initialized - capabilities registered');
  return result;
});

// After initialization, scan workspace for all .pss files
connection.onInitialized(() => {
  const folders = initParams.workspaceFolders;
  if (folders) {
    for (const folder of folders) {
      const folderPath = folder.uri.startsWith('file://') ? fileURLToPath(folder.uri) : null;
      if (folderPath) {
        connection.console.info(`[workspace] Scanning ${folderPath} for .pss files`);
        scanDirectory(folderPath);
      }
    }
    // Publish diagnostics for all indexed files
    for (const uri of index.getFileUris()) {
      try {
        const diagnostics = index.getDiagnostics(uri).map(convertDiagnostic);
        connection.sendDiagnostics({ uri, diagnostics });
      } catch (_) { /* ignore errors during initial scan */ }
    }
  }
});

/** Recursively find and index all .pss files in a directory. */
function scanDirectory(dir: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = nodePath.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      scanDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.pss')) {
      try {
        const text = fs.readFileSync(fullPath, 'utf-8');
        const uri = pathToFileURL(fullPath).toString();
        if (!index.getAST(uri)) {
          index.addFile(uri, text);
          connection.console.log(`[workspace] Indexed ${uri}`);
        }
      } catch (_) { /* skip unreadable files */ }
    }
  }
}

function updateDocument(textDocument: TextDocument): void {
  const uri = textDocument.uri;
  const text = textDocument.getText();
  connection.console.log(`[updateDocument] ${uri} (${text.length} chars)`);

  if (index.getAST(uri)) {
    index.updateFile(uri, text);
  } else {
    index.addFile(uri, text);
  }

  try {
    const diagnostics = index.getDiagnostics(uri).map(convertDiagnostic);
    connection.sendDiagnostics({ uri, diagnostics });
    connection.console.log(`[updateDocument] ${uri} - ${diagnostics.length} diagnostics`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    connection.console.error(`[updateDocument] analysis error for ${uri}: ${msg}`);
  }

  try {
    for (const depUri of index.getDependents(uri)) {
      const depDiags = index.getDiagnostics(depUri).map(convertDiagnostic);
      connection.sendDiagnostics({ uri: depUri, diagnostics: depDiags });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    connection.console.error(`[updateDocument] dependency analysis error: ${msg}`);
  }
}

// Edit debouncing: wait 300ms after last change before re-parsing
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

documents.onDidChangeContent(change => {
  const uri = change.document.uri;
  const existing = debounceTimers.get(uri);
  if (existing) clearTimeout(existing);

  debounceTimers.set(uri, setTimeout(() => {
    debounceTimers.delete(uri);
    updateDocument(change.document);
  }, 300));
});

documents.onDidClose(e => {
  index.removeFile(e.document.uri);
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// Ensure the document is up-to-date (flush any pending debounce and reparse).
// Called by request handlers that need the current AST.
function ensureParsed(uri: string): void {
  const pending = debounceTimers.get(uri);
  if (pending) {
    // Edits are pending -- cancel the timer and parse now
    clearTimeout(pending);
    debounceTimers.delete(uri);
    const doc = documents.get(uri);
    if (doc) {
      connection.console.log(`[ensureParsed] flushing pending edits for ${uri}`);
      updateDocument(doc);
    }
  } else if (!index.getAST(uri)) {
    // No AST at all (file just opened, first parse not yet triggered)
    const doc = documents.get(uri);
    if (doc) {
      connection.console.log(`[ensureParsed] initial parse for ${uri}`);
      updateDocument(doc);
    }
  }
}

// Phase 1
connection.onDocumentSymbol((params: DocumentSymbolParams) => {
  const uri = params.textDocument.uri;
  ensureParsed(uri);
  const ast = index.getAST(uri);
  connection.console.log(`[documentSymbol] ${uri} - AST ${ast ? 'found' : 'NOT FOUND'}`);
  if (!ast) return [];
  const result = handleDocumentSymbol(params, u => index.getAST(u));
  connection.console.log(`[documentSymbol] ${uri} - returning ${result.length} symbols`);
  return result;
});

// Phase 2
connection.onHover((params: HoverParams) => handleHover(params, index));
connection.onDefinition((params: DefinitionParams) => handleDefinition(params, index));
connection.onReferences((params: ReferenceParams) => handleReferences(params, index));

// Phase 3
connection.onCompletion((params: CompletionParams) => {
  ensureParsed(params.textDocument.uri);
  return handleCompletion(params, index, uri => documents.get(uri)?.getText());
});
connection.onCompletionResolve((item: CompletionItem) => handleCompletionResolve(item, index));
connection.onSignatureHelp((params: SignatureHelpParams) => handleSignatureHelp(params, index));
connection.onFoldingRanges((params: FoldingRangeParams) => handleFoldingRanges(params, index));
connection.onWorkspaceSymbol((params: WorkspaceSymbolParams) => {
  const allAsts = new Map<string, GlobalScope>();
  for (const uri of index.getFileUris()) {
    const ast = index.getAST(uri);
    if (ast) allAsts.set(uri, ast);
  }
  const symbols = getWorkspaceSymbols(params.query, allAsts);
  return symbols.map(s => ({
    name: s.name,
    kind: convertSymbolKind(s.kind),
    location: { uri: '', range: s.range },
  }));
});
connection.languages.semanticTokens.on((params: SemanticTokensParams) =>
  handleSemanticTokensFull(params, index));

// Phase 4
connection.onPrepareRename((params: PrepareRenameParams) => handlePrepareRename(params, index));
connection.onRenameRequest((params: RenameParams) => handleRename(params, index));
connection.onCodeAction((params: CodeActionParams) => handleCodeAction(params, index));
connection.languages.callHierarchy.onPrepare((params: CallHierarchyPrepareParams) =>
  handlePrepareCallHierarchy(params, index));
connection.languages.callHierarchy.onIncomingCalls((params: CallHierarchyIncomingCallsParams) =>
  handleIncomingCalls(params, index));
connection.languages.callHierarchy.onOutgoingCalls((params: CallHierarchyOutgoingCallsParams) =>
  handleOutgoingCalls(params, index));
connection.languages.typeHierarchy.onPrepare((params: TypeHierarchyPrepareParams) =>
  handlePrepareTypeHierarchy(params, index));
connection.languages.typeHierarchy.onSupertypes((params: TypeHierarchySupertypesParams) =>
  handleSupertypes(params, index));
connection.languages.typeHierarchy.onSubtypes((params: TypeHierarchySubtypesParams) =>
  handleSubtypes(params, index));
connection.languages.inlayHint.on((params: InlayHintParams) =>
  handleInlayHints(params, index));

// Phase 5
connection.onDocumentFormatting((params) =>
  handleFormatting(params, index, uri => documents.get(uri)));
connection.onDocumentRangeFormatting((params) =>
  handleRangeFormatting(params, index, uri => documents.get(uri)));
connection.onCodeLens((params) => handleCodeLens(params, index));

// Handle file system changes (create/delete .pss files)
connection.onDidChangeWatchedFiles(change => {
  for (const event of change.changes) {
    if (!event.uri.endsWith('.pss')) continue;
    const uri = event.uri;
    if (event.type === 3 /* Deleted */) {
      index.removeFile(uri);
      connection.sendDiagnostics({ uri, diagnostics: [] });
    } else if (event.type === 1 /* Created */ || event.type === 2 /* Changed */) {
      // File created or changed on disk -- read and index if not already open
      if (uri.startsWith('file://')) {
        try {
          const fsPath = fileURLToPath(uri);
          const text = fs.readFileSync(fsPath, 'utf-8');
          if (index.getAST(uri)) {
            index.updateFile(uri, text);
          } else {
            index.addFile(uri, text);
          }
          const diagnostics = index.getDiagnostics(uri).map(convertDiagnostic);
          connection.sendDiagnostics({ uri, diagnostics });
        } catch (_) { /* skip unreadable */ }
      }
    }
  }
});

// Custom request: build activity diagram for a given file + line
connection.onRequest('pss/activityDiagram', (params: { uri: string; line: number }) => {
  ensureParsed(params.uri);
  const ast = index.getAST(params.uri);
  if (!ast) return null;

  // Find the ActivityDecl at or near the given line
  for (const node of walkScope(ast)) {
    if (node instanceof ActivityDecl) {
      const loc = node.location;
      if (loc.lineno - 1 === params.line || (loc.lineno - 1 <= params.line && params.line <= loc.lineno + 20)) {
        const builder = new ActivityDiagramBuilder();
        const graph = builder.build(node, params.uri);
        return graph.toJSON();
      }
    }
  }
  return null;
});

documents.listen(connection);
connection.listen();
