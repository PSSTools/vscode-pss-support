import { HoverParams, Hover } from 'vscode-languageserver/node';
import { getHover } from '../core/services/HoverService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

/**
 * LSP handler for textDocument/hover requests.
 */
export function handleHover(
  params: HoverParams,
  index: WorkspaceIndex,
): Hover | null {
  const result = getHover(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
  );
  if (!result) return null;
  return {
    contents: { kind: 'markdown', value: result.contents },
    range: result.range,
  };
}
