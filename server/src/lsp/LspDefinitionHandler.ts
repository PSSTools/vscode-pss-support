import { DefinitionParams, Location } from 'vscode-languageserver/node';
import { getDefinition } from '../core/services/DefinitionService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

/**
 * LSP handler for textDocument/definition requests.
 */
export function handleDefinition(
  params: DefinitionParams,
  index: WorkspaceIndex,
): Location[] {
  const results = getDefinition(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
  );
  return results.map(r => ({
    uri: r.uri,
    range: r.range,
  }));
}
