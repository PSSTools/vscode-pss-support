import {
  CodeActionParams,
  CodeAction as LspCodeAction,
  CodeActionKind,
  WorkspaceEdit,
} from 'vscode-languageserver/node';
import { getCodeActions } from '../core/services/CodeActionService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';
import { convertDiagnostic } from './LspTypeConverters';
import { Diagnostic } from '../core/types/Diagnostic';

export function handleCodeAction(
  params: CodeActionParams,
  index: WorkspaceIndex,
): LspCodeAction[] {
  // Convert LSP diagnostics back to model diagnostics
  const modelDiags: Diagnostic[] = params.context.diagnostics.map(d => ({
    range: d.range,
    severity: d.severity as any,
    code: d.code as string | undefined,
    source: d.source,
    message: d.message,
  }));

  const actions = getCodeActions(
    params.textDocument.uri,
    params.range,
    modelDiags,
    index,
  );

  return actions.map(a => {
    const changes: { [uri: string]: Array<{ range: any; newText: string }> } = {};
    for (const [uri, edits] of a.edits) {
      changes[uri] = edits.map(e => ({ range: e.range, newText: e.newText }));
    }

    return {
      title: a.title,
      kind: a.kind === 'quickfix' ? CodeActionKind.QuickFix : CodeActionKind.Source,
      diagnostics: a.diagnostics?.map(convertDiagnostic),
      edit: { changes },
    };
  });
}
