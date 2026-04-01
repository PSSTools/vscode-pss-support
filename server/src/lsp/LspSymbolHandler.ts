import { DocumentSymbolParams, DocumentSymbol } from 'vscode-languageserver/node';
import { GlobalScope } from '../core/ast/generated';
import { getDocumentSymbols } from '../core/services/SymbolService';
import { convertDocumentSymbol } from './LspTypeConverters';

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
