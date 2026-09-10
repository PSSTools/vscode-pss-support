import { CodeLensParams, CodeLens } from 'vscode-languageserver/node.js';
import { getCodeLenses } from '../core/services/CodeLensService.js';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';

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
