import { HoverParams, Hover } from 'vscode-languageserver/node.js';
import { getHover } from '../core/services/HoverService.js';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';
import { ClientSupport, FULL_SUPPORT } from './ClientSupport.js';

/**
 * LSP handler for textDocument/hover requests.
 *
 * HoverService writes markdown. A client that does not take markdown gets
 * plaintext: the same text without the code fences and bold labels, which
 * would otherwise be shown as literal backticks and asterisks.
 */
export function handleHover(
  params: HoverParams,
  index: WorkspaceIndex,
  support: ClientSupport = FULL_SUPPORT,
): Hover | null {
  const result = getHover(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
  );
  if (!result) return null;
  return {
    contents: support.hoverMarkdown
      ? { kind: 'markdown', value: result.contents }
      : { kind: 'plaintext', value: markdownToPlaintext(result.contents) },
    range: result.range,
  };
}

/** Undo the markup HoverService adds. Doc comments are left as written. */
export function markdownToPlaintext(markdown: string): string {
  return markdown
    .split('\n')
    .filter(line => !/^```\w*$/.test(line))
    .join('\n')
    .replace(/\*\*([^*\n]+):\*\*/g, '$1:');
}
