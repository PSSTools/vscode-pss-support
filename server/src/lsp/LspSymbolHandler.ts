import { DocumentSymbolParams, DocumentSymbol, SymbolInformation } from 'vscode-languageserver/node.js';
import { GlobalScope } from '../core/ast/generated/index.js';
import { getDocumentSymbols } from '../core/services/SymbolService.js';
import { DocumentSymbol as CoreDocumentSymbol } from '../core/types/DocumentSymbol.js';
import { convertDocumentSymbol, convertSymbolKind } from './LspTypeConverters.js';
import { ClientSupport, FULL_SUPPORT } from './ClientSupport.js';

/**
 * Handles textDocument/documentSymbol requests.
 *
 * A symbol tree for a client that supports one; otherwise the protocol's
 * original flat list, each entry naming its parent in `containerName`.
 */
export function handleDocumentSymbol(
  params: DocumentSymbolParams,
  getAST: (uri: string) => GlobalScope | undefined,
  support: ClientSupport = FULL_SUPPORT,
): DocumentSymbol[] | SymbolInformation[] {
  const ast = getAST(params.textDocument.uri);
  if (!ast) return [];

  const symbols = getDocumentSymbols(ast);
  if (support.hierarchicalSymbols) {
    const withKinds = (s: DocumentSymbol): DocumentSymbol => ({
      ...s,
      kind: support.documentSymbolKind(s.kind),
      children: s.children?.map(withKinds),
    });
    return symbols.map(s => withKinds(convertDocumentSymbol(s)));
  }

  const flat: SymbolInformation[] = [];
  const visit = (s: CoreDocumentSymbol, containerName?: string) => {
    flat.push({
      name: s.name,
      kind: support.documentSymbolKind(convertSymbolKind(s.kind)),
      location: { uri: params.textDocument.uri, range: s.range },
      containerName,
    });
    for (const child of s.children ?? []) visit(child, s.name);
  };
  for (const s of symbols) visit(s);
  return flat;
}
