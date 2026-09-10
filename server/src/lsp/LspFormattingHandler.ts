import {
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  TextEdit as LspTextEdit,
} from 'vscode-languageserver/node.js';
import { formatDocument, formatRange } from '../core/services/FormatterService.js';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';
import { IConfiguration } from '../core/io/IConfiguration.js';

export function handleFormatting(
  params: DocumentFormattingParams,
  index: WorkspaceIndex,
  config?: IConfiguration,
): LspTextEdit[] {
  const ast = index.getAST(params.textDocument.uri);
  const text = index.getText(params.textDocument.uri);
  if (!ast || text === undefined) return [];

  const edits = formatDocument(text, ast, config);
  return edits.map(e => ({ range: e.range, newText: e.newText }));
}

export function handleRangeFormatting(
  params: DocumentRangeFormattingParams,
  index: WorkspaceIndex,
  config?: IConfiguration,
): LspTextEdit[] {
  const ast = index.getAST(params.textDocument.uri);
  const text = index.getText(params.textDocument.uri);
  if (!ast || text === undefined) return [];

  const edits = formatRange(text, params.range, ast, config);
  return edits.map(e => ({ range: e.range, newText: e.newText }));
}
