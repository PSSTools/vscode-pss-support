import {
  Connection,
  TextDocuments,
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
  CodeLensParams,
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';
import { WorkspaceLoader } from '../core/index/WorkspaceLoader.js';
import { DocumentSession } from '../core/index/DocumentSession.js';
import { handleDocumentSymbol } from './LspSymbolHandler.js';
import { handleHover } from './LspHoverHandler.js';
import { handleDefinition } from './LspDefinitionHandler.js';
import { handleReferences } from './LspReferencesHandler.js';
import { handleCompletion, handleCompletionResolve } from './LspCompletionHandler.js';
import { handleSignatureHelp } from './LspSignatureHelpHandler.js';
import { handleSemanticTokensFull, SEMANTIC_TOKENS_LEGEND } from './LspSemanticTokensHandler.js';
import { handleFoldingRanges } from './LspFoldingHandler.js';
import { handlePrepareRename, handleRename } from './LspRenameHandler.js';
import { handleCodeAction } from './LspCodeActionHandler.js';
import { handlePrepareCallHierarchy, handleIncomingCalls, handleOutgoingCalls } from './LspCallHierarchyHandler.js';
import { handlePrepareTypeHierarchy, handleSupertypes, handleSubtypes } from './LspTypeHierarchyHandler.js';
import { handleInlayHints } from './LspInlayHintHandler.js';
import { handleWorkspaceSymbol } from './LspWorkspaceSymbolHandler.js';
import { convertDiagnostic } from './LspTypeConverters.js';
import { handleFormatting, handleRangeFormatting } from './LspFormattingHandler.js';
import { handleCodeLens } from './LspCodeLensHandler.js';
import { handleActivityDiagram } from './LspActivityDiagramHandler.js';
import { loadPSSConfig, PSSConfigAdapter } from '../core/config/PSSConfigLoader.js';
import { IConfiguration } from '../core/io/IConfiguration.js';
import { uriToPath } from '../core/io/UriUtils.js';
import { nodeFileSystem } from '../core/io/NodeFileSystem.js';

/**
 * Wire every LSP request handler onto a connection.
 *
 * Kept separate from the process entry point so the server can be started on
 * any connection -- in particular an in-memory stream pair, which is what makes
 * the protocol testable without an editor. `server.ts` is now only the few
 * lines that create a stdio connection and hand it here.
 */
export interface LanguageServerOptions {
  /** Directory of packaged stdlib sources. Defaults to the resolved location. */
  stdlibDir?: string;
  /** Debounce for re-parsing after an edit; 0 makes edits apply synchronously. */
  debounceMs?: number;
}

export function startLanguageServer(
  connection: Connection,
  options: LanguageServerOptions = {},
): void {
  let initParams: InitializeParams;
  const documents = new TextDocuments(TextDocument);

  const index = new WorkspaceIndex(options.stdlibDir);

  const session = new DocumentSession(index, {
    debounceMs: options.debounceMs,
    onDiagnostics: (uri, diagnostics) => {
      connection.sendDiagnostics({ uri, diagnostics: diagnostics.map(convertDiagnostic) });
    },
    onError: (uri, error) => {
      connection.console.error(`[analysis] ${uri}: ${error.message}`);
    },
    onLog: (message) => connection.console.log(message),
  });

  /**
   * Workspace configuration, read once at startup from .pssconfig.json.
   * Passed to every service that accepts an IConfiguration -- before this was
   * wired, `pss.maxNumberOfProblems` and the formatter options were declared but
   * never reached the code that reads them.
   */
  let config: IConfiguration = new PSSConfigAdapter({});

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

  // After initialization, scan the workspace for all .pss files
  connection.onInitialized(async () => {
    const folders = initParams.workspaceFolders;
    if (!folders) return;

    const rootUris = folders.map(f => f.uri).filter(uri => uri.startsWith('file://'));

    if (rootUris.length > 0) {
      config = new PSSConfigAdapter(loadPSSConfig(uriToPath(rootUris[0])));
    }

    const loader = new WorkspaceLoader();
    const added = await loader.loadInto(index, rootUris);
    connection.console.info(`[workspace] Indexed ${added.length} .pss files`);

    for (const uri of index.getFileUris()) {
      try {
        connection.sendDiagnostics({
          uri,
          diagnostics: index.getDiagnostics(uri).map(convertDiagnostic),
        });
      } catch (_) { /* ignore errors during initial scan */ }
    }
  });

  documents.onDidChangeContent(change => {
    session.didChangeContent(change.document.uri, change.document.getText());
  });

  documents.onDidClose(e => {
    session.didClose(e.document.uri);
  });

  /** Flush pending edits so a request is never answered from a stale AST. */
  function ensureParsed(uri: string): void {
    session.ensureParsed(uri);
  }

  // Phase 1
  connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    ensureParsed(params.textDocument.uri);
    return handleDocumentSymbol(params, u => index.getAST(u));
  });

  // Phase 2
  connection.onHover((params: HoverParams) => {
    ensureParsed(params.textDocument.uri);
    return handleHover(params, index);
  });
  connection.onDefinition((params: DefinitionParams) => {
    ensureParsed(params.textDocument.uri);
    return handleDefinition(params, index);
  });
  connection.onReferences((params: ReferenceParams) => {
    ensureParsed(params.textDocument.uri);
    return handleReferences(params, index);
  });

  // Phase 3
  connection.onCompletion((params: CompletionParams) => {
    ensureParsed(params.textDocument.uri);
    return handleCompletion(params, index, config);
  });
  connection.onCompletionResolve((item: CompletionItem) => handleCompletionResolve(item, index));
  connection.onSignatureHelp((params: SignatureHelpParams) => {
    ensureParsed(params.textDocument.uri);
    return handleSignatureHelp(params, index);
  });
  connection.onFoldingRanges((params: FoldingRangeParams) => {
    ensureParsed(params.textDocument.uri);
    return handleFoldingRanges(params, index);
  });
  connection.onWorkspaceSymbol((params: WorkspaceSymbolParams) => {
    // Workspace-scoped: there is no document to flush, so flush them all.
    session.flushAll();
    return handleWorkspaceSymbol(params, index);
  });
  connection.languages.semanticTokens.on((params: SemanticTokensParams) => {
    ensureParsed(params.textDocument.uri);
    return handleSemanticTokensFull(params, index);
  });

  // Phase 4
  connection.onPrepareRename((params: PrepareRenameParams) => {
    ensureParsed(params.textDocument.uri);
    return handlePrepareRename(params, index);
  });
  connection.onRenameRequest((params: RenameParams) => {
    ensureParsed(params.textDocument.uri);
    return handleRename(params, index);
  });
  connection.onCodeAction((params: CodeActionParams) => {
    ensureParsed(params.textDocument.uri);
    return handleCodeAction(params, index);
  });
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
  connection.languages.inlayHint.on((params: InlayHintParams) => {
    ensureParsed(params.textDocument.uri);
    return handleInlayHints(params, index);
  });

  // Phase 5
  connection.onDocumentFormatting((params) => {
    ensureParsed(params.textDocument.uri);
    return handleFormatting(params, index, config);
  });
  connection.onDocumentRangeFormatting((params) => {
    ensureParsed(params.textDocument.uri);
    return handleRangeFormatting(params, index, config);
  });
  connection.onCodeLens((params: CodeLensParams) => {
    ensureParsed(params.textDocument.uri);
    return handleCodeLens(params, index);
  });

  // Handle file system changes (create/delete .pss files)
  connection.onDidChangeWatchedFiles(change => {
    for (const event of change.changes) {
      if (!event.uri.endsWith('.pss')) continue;
      if (event.type === 3 /* Deleted */) {
        session.didDeleteOnDisk(event.uri);
      } else if (event.uri.startsWith('file://')) {
        const text = nodeFileSystem.readFile(uriToPath(event.uri));
        if (text !== undefined) session.didChangeOnDisk(event.uri, text);
      }
    }
  });

  // Custom request: build activity diagram for a given file + line
  connection.onRequest('pss/activityDiagram', (params: { uri: string; line: number }) => {
    ensureParsed(params.uri);
    return handleActivityDiagram(params, index);
  });

  documents.listen(connection);

}
