import { SignatureHelpParams, SignatureHelp, SignatureInformation, ParameterInformation } from 'vscode-languageserver/node';
import { getSignatureHelp } from '../core/services/SignatureService';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex';

export function handleSignatureHelp(
  params: SignatureHelpParams,
  index: WorkspaceIndex,
): SignatureHelp | null {
  const result = getSignatureHelp(
    params.textDocument.uri,
    { line: params.position.line, character: params.position.character },
    index,
  );
  if (!result) return null;

  const sig: SignatureInformation = {
    label: result.label,
    documentation: result.documentation,
    parameters: result.parameters.map(p => ({
      label: p.label,
      documentation: p.documentation,
    })),
  };

  return {
    signatures: [sig],
    activeSignature: 0,
    activeParameter: result.activeParameter,
  };
}
