import { RenameParams, WorkspaceEdit, PrepareRenameParams, Range } from 'vscode-languageserver/node';
import { prepareRename, rename } from '../core/services/RenameService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

export function handlePrepareRename(
  params: PrepareRenameParams,
  index: WorkspaceIndex,
): { range: Range; placeholder: string } | null {
  const result = prepareRename(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
  );
  return result;
}

export function handleRename(
  params: RenameParams,
  index: WorkspaceIndex,
): WorkspaceEdit {
  const result = rename(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    params.newName,
    index,
  );

  const changes: { [uri: string]: Array<{ range: Range; newText: string }> } = {};
  for (const [uri, edits] of result.edits) {
    changes[uri] = edits.map(e => ({
      range: e.range,
      newText: e.newText,
    }));
  }

  return { changes };
}
