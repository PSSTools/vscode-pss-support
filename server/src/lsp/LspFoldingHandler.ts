import { FoldingRangeParams, FoldingRange as LspFoldingRange, FoldingRangeKind } from 'vscode-languageserver/node';
import { getFoldingRanges } from '../core/services/FoldingService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

export function handleFoldingRanges(
  params: FoldingRangeParams,
  index: WorkspaceIndex,
): LspFoldingRange[] {
  const ast = index.getAST(params.textDocument.uri);
  if (!ast) return [];

  const ranges = getFoldingRanges(ast);

  return ranges.map(r => {
    const result: LspFoldingRange = {
      startLine: r.startLine,
      startCharacter: r.startCharacter,
      endLine: r.endLine,
      endCharacter: r.endCharacter,
    };
    if (r.kind === 'comment') result.kind = FoldingRangeKind.Comment;
    if (r.kind === 'imports') result.kind = FoldingRangeKind.Imports;
    if (r.kind === 'region') result.kind = FoldingRangeKind.Region;
    return result;
  });
}
