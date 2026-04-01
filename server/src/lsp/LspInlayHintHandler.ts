import {
  InlayHintParams,
  InlayHint as LspInlayHint,
  InlayHintKind,
} from 'vscode-languageserver/node';
import { getInlayHints } from '../core/services/InlayHintService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

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
