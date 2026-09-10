import {
  InlayHintParams,
  InlayHint as LspInlayHint,
  InlayHintKind,
} from 'vscode-languageserver/node.js';
import { getInlayHints } from '../core/services/InlayHintService.js';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';

export function handleInlayHints(
  params: InlayHintParams,
  index: WorkspaceIndex,
): LspInlayHint[] {
  const hints = getInlayHints(
    params.textDocument.uri,
    params.range,
    index,
  );

  return hints.map(h => ({
    position: h.position,
    label: h.label,
    kind: h.kind === 'type' ? InlayHintKind.Type : InlayHintKind.Parameter,
    paddingLeft: h.paddingLeft,
    paddingRight: h.paddingRight,
  }));
}
