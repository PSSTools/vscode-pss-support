import { ReferenceParams, Location } from 'vscode-languageserver/node';
import { getReferences } from '../core/services/ReferencesService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

/**
 * LSP handler for textDocument/references requests.
 */
export function handleReferences(
  params: ReferenceParams,
  index: WorkspaceIndex,
): Location[] {
  const results = getReferences(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
    params.context.includeDeclaration,
  );
  return results.map(r => ({
    uri: r.uri,
    range: r.range,
  }));
}
