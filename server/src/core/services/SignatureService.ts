import {
  ScopeChild,
  Scope,
  FunctionDefinition,
  FunctionPrototype,
  FunctionParamDecl,
  DataTypeBool,
  DataTypeInt,
  DataTypeString,
  DataTypeUserDefined,
} from '../ast/generated';
import { SourcePosition } from '../types/SourcePosition';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { findNodeAtPosition } from '../ast/ASTUtils';

export interface SignatureResult {
  label: string;
  documentation?: string;
  parameters: ParameterInfo[];
  activeParameter: number;
}

export interface ParameterInfo {
  label: string;
  documentation?: string;
}

/**
 * Detect if cursor is inside a function parameter list and return
 * signature help with active parameter tracking.
 */
export function getSignatureHelp(
  uri: string,
  position: SourcePosition,
  index: WorkspaceIndex,
): SignatureResult | undefined {
  const ast = index.getAST(uri);
  if (!ast) return undefined;

  const node = findNodeAtPosition(ast, position);
  if (!node) return undefined;

  // Walk up to find an enclosing function call or definition
  let current: ScopeChild | null = node;
  while (current) {
    if (current instanceof FunctionDefinition && current.proto) {
      return buildSignatureFromProto(current.proto, 0);
    }
    current = current.parent;
  }

  return undefined;
}

function buildSignatureFromProto(
  proto: FunctionPrototype,
  activeParam: number,
): SignatureResult {
  const name = proto.name?.id ?? '?';
  const rtype = getDataTypeName(proto.rtype);
  const params = proto.parameters.map(p => {
    const pName = p.name?.id ?? '?';
    const pType = getDataTypeName(p.type);
    return { label: `${pType} ${pName}`, documentation: undefined };
  });

  const paramLabels = params.map(p => p.label).join(', ');
  const label = `${rtype} ${name}(${paramLabels})`;

  return {
    label,
    documentation: proto.docstring?.trim() || undefined,
    parameters: params,
    activeParameter: Math.min(activeParam, params.length - 1),
  };
}

function getDataTypeName(dt: unknown): string {
  if (!dt) return 'void';
  if (dt instanceof DataTypeBool) return 'bool';
  if (dt instanceof DataTypeInt) return dt.is_signed ? 'int' : 'bit';
  if (dt instanceof DataTypeString) return 'string';
  if (dt instanceof DataTypeUserDefined) {
    return dt.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
  }
  return '?';
}
