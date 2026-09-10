import { DocumentSymbolParams, DocumentSymbol } from 'vscode-languageserver/node.js';
import { GlobalScope } from '../core/ast/generated/index.js';
import { getDocumentSymbols } from '../core/services/SymbolService.js';
import { convertDocumentSymbol } from './LspTypeConverters.js';

/**
 * Handles textDocument/documentSymbol requests.
 */
export function handleDocumentSymbol(
  params: DocumentSymbolParams,
  getAST: (uri: string) => GlobalScope | undefined,
): DocumentSymbol[] {
  const ast = getAST(params.textDocument.uri);
  if (!ast) return [];

  const symbols = getDocumentSymbols(ast);
  return symbols.map(convertDocumentSymbol);
}
