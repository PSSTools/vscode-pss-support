import { HoverParams, Hover } from 'vscode-languageserver/node.js';
import { getHover } from '../core/services/HoverService.js';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';

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
