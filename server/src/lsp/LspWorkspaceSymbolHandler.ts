import { WorkspaceSymbolParams, SymbolInformation } from 'vscode-languageserver/node.js';
import { getWorkspaceSymbols } from '../core/services/SymbolService.js';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';
import { GlobalScope } from '../core/ast/generated/index.js';
import { convertSymbolKind } from './LspTypeConverters.js';

/**
 * LSP handler for workspace/symbol requests.
 *
 * Previously inlined in server.ts, where it emitted `location.uri: ''` -- the
 * results rendered in the Ctrl-T list but could not be opened.
 */
export function handleWorkspaceSymbol(
  params: WorkspaceSymbolParams,
  index: WorkspaceIndex,
): SymbolInformation[] {
  const allAsts = new Map<string, GlobalScope>();
  for (const uri of index.getFileUris()) {
    const ast = index.getAST(uri);
    if (ast) allAsts.set(uri, ast);
  }

  return getWorkspaceSymbols(params.query, allAsts).map(s => ({
    name: s.name,
    kind: convertSymbolKind(s.kind),
    containerName: s.containerName || undefined,
    location: { uri: s.uri, range: s.selectionRange },
  }));
}
