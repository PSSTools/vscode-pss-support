import {
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  TextEdit as LspTextEdit,
} from 'vscode-languageserver/node';
import { formatDocument, formatRange } from '../core/services/FormatterService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';
import { IConfiguration } from '../core/io/IConfiguration';

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
