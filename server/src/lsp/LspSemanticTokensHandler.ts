import {
  SemanticTokensParams,
  SemanticTokens,
  SemanticTokensLegend,
} from 'vscode-languageserver/node';
import { getSemanticTokens, TOKEN_TYPES, TOKEN_MODIFIERS } from '../core/services/SemanticTokenService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: TOKEN_TYPES,
  tokenModifiers: TOKEN_MODIFIERS,
};

export function handleSemanticTokensFull(
  params: SemanticTokensParams,
  index: WorkspaceIndex,
): SemanticTokens {
  const ast = index.getAST(params.textDocument.uri);
  if (!ast) return { data: [] };

  const tokens = getSemanticTokens(ast);

  // Encode as relative positions per LSP spec
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;

  for (const token of tokens) {
    const deltaLine = token.line - prevLine;
    const deltaChar = deltaLine === 0 ? token.startChar - prevChar : token.startChar;

    data.push(deltaLine, deltaChar, token.length, token.tokenType, token.tokenModifiers);

    prevLine = token.line;
    prevChar = token.startChar;
  }

  return { data };
}
