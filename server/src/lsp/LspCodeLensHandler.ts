import { CodeLensParams, CodeLens } from 'vscode-languageserver/node';
import { getCodeLenses } from '../core/services/CodeLensService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

export function handleCodeLens(
  params: CodeLensParams,
  index: WorkspaceIndex,
): CodeLens[] {
  const items = getCodeLenses(params.textDocument.uri, index);

  return items.map(item => ({
    range: item.range,
    command: {
      title: item.title,
      command: item.command,
      arguments: item.arguments,
    },
  }));
}
