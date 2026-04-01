import {
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  TextEdit as LspTextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { formatDocument, formatRange } from '../core/services/FormatterService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

export function handleFormatting(
  params: DocumentFormattingParams,
  index: WorkspaceIndex,
  getDoc: (uri: string) => TextDocument | undefined,
): LspTextEdit[] {
  const ast = index.getAST(params.textDocument.uri);
  const doc = getDoc(params.textDocument.uri);
  if (!ast || !doc) return [];

  const edits = formatDocument(doc.getText(), ast);
  return edits.map(e => ({ range: e.range, newText: e.newText }));
}

export function handleRangeFormatting(
  params: DocumentRangeFormattingParams,
  index: WorkspaceIndex,
  getDoc: (uri: string) => TextDocument | undefined,
): LspTextEdit[] {
  const ast = index.getAST(params.textDocument.uri);
  const doc = getDoc(params.textDocument.uri);
  if (!ast || !doc) return [];

  const edits = formatRange(doc.getText(), params.range, ast);
  return edits.map(e => ({ range: e.range, newText: e.newText }));
}
