import {
  ScopeChild,
  Scope,
  TypeScope,
  NamedScope,
  NamedScopeChild,
  Action,
  Component,
  Struct,
  Field,
  FieldCompRef,
  FieldRef,
  FieldClaim,
  ActionHandleField,
  EnumDecl,
  EnumItem,
  FunctionDefinition,
  FunctionPrototype,
  ActivityDecl,
  ExecBlock,
  TypedefDeclaration,
  AnnotationDecl,
  Monitor,
  PackageScope,
  DataTypeUserDefined,
  DataTypeBool,
  DataTypeInt,
  DataTypeString,
  TypeIdentifier,
  ActivityActionTypeTraversal,
  RootSymbolScope,
  enums,
  flags,
} from '../ast/generated';
import { HoverResult } from '../types/HoverResult';
import { SourcePosition } from '../types/SourcePosition';
import { SourceRange } from '../types/SourceRange';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { findNodeAtPosition, getNodeName, getNodeSignature } from '../ast/ASTUtils';
import { resolveTypeAtPosition, findSymbolScope } from '../analysis/SymbolLookup';

/**
 * Given a position in a file, produce hover information including
 * signature, doc comment, type info, and annotations.
 */
export function getHover(
  uri: string,
  position: SourcePosition,
  index: WorkspaceIndex,
): HoverResult | undefined {
  const ast = index.getAST(uri);
  if (!ast) return undefined;

  const node = findNodeAtPosition(ast, position);
  if (!node) return undefined;

  const analysisResult = index.getAnalysisResult();

  // Try resolving a type reference at the cursor position first
  const resolved = analysisResult
    ? resolveTypeRefForHover(node, position, analysisResult.root)
    : null;

  const contents = resolved
    ? buildHoverContent(resolved, index, uri)
    : buildHoverContent(node, index, uri);
  if (!contents) return undefined;

  // Use the reference node's location for the hover range (not the
  // resolved declaration), so the popup appears at the cursor site.
  const loc = node.location;
  const range: SourceRange | undefined = loc.lineno >= 0
    ? {
        start: { line: loc.lineno - 1, character: loc.linepos },
        end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : 1) },
      }
    : undefined;

  return { contents, range };
}

function buildHoverContent(node: ScopeChild, index: WorkspaceIndex, uri: string): string | null {
  const parts: string[] = [];

  // Signature line
  const sig = getSignatureLine(node);
  if (sig) {
    parts.push('```pss\n' + sig + '\n```');
  }

  // Doc comment
  if (node.docstring) {
    parts.push(node.docstring.trim());
  }

  // Type information for fields
  const typeInfo = getTypeInfo(node);
  if (typeInfo) {
    parts.push('**Type:** ' + typeInfo);
  }

  // Location info for cross-file references
  const locInfo = getLocationInfo(node, index, uri);
  if (locInfo) {
    parts.push(locInfo);
  }

  // Annotations
  if (node.annotations && node.annotations.length > 0) {
    const annStrings = node.annotations.map(a => {
      const typeName = a.type?.elems.map(e => e.id?.id).join('::') ?? '?';
      return '@' + typeName;
    });
    parts.push('**Annotations:** ' + annStrings.join(', '));
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

function getSignatureLine(node: ScopeChild): string | null {
  if (node instanceof Action) {
    const abs = node.is_abstract ? 'abstract ' : '';
    const name = node.name?.id ?? '?';
    const superPart = node.super_t
      ? ' : ' + node.super_t.elems.map(e => e.id?.id).join('::')
      : '';
    return `${abs}action ${name}${superPart}`;
  }

  if (node instanceof Component) {
    const name = node.name?.id ?? '?';
    const superPart = node.super_t
      ? ' : ' + node.super_t.elems.map(e => e.id?.id).join('::')
      : '';
    return `component ${name}${superPart}`;
  }

  if (node instanceof Struct) {
    const name = node.name?.id ?? '?';
    const kind = enums.StructKind[node.kind]?.toLowerCase() ?? 'struct';
    const superPart = node.super_t
      ? ' : ' + node.super_t.elems.map(e => e.id?.id).join('::')
      : '';
    return `${kind} ${name}${superPart}`;
  }

  if (node instanceof Monitor) {
    const name = node.name?.id ?? '?';
    return `monitor ${name}`;
  }

  if (node instanceof Field) {
    return getNodeSignature(node);
  }

  if (node instanceof FieldCompRef) {
    const name = node.name?.id ?? '?';
    const typeName = node.type?.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
    return `${typeName} ${name}`;
  }

  if (node instanceof FieldRef) {
    const name = node.name?.id ?? '?';
    const dir = node.is_input ? 'input' : 'output';
    const typeName = node.type?.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
    return `${dir} ${typeName} ${name}`;
  }

  if (node instanceof FieldClaim) {
    const name = node.name?.id ?? '?';
    const kind = node.is_lock ? 'lock' : 'share';
    const typeName = node.type?.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
    return `${kind} ${typeName} ${name}`;
  }

  if (node instanceof ActionHandleField) {
    const name = node.name?.id ?? '?';
    const typeName = node.type instanceof DataTypeUserDefined
      ? node.type.type_id?.elems.map(e => e.id?.id).join('::') ?? '?'
      : '?';
    return `action ${typeName} ${name}`;
  }

  if (node instanceof EnumDecl) {
    const name = node.name?.id ?? '?';
    return `enum ${name}`;
  }

  if (node instanceof EnumItem) {
    const name = node.name?.id ?? '?';
    return `enum item ${name}`;
  }

  if (node instanceof FunctionDefinition && node.proto) {
    return getFunctionSignature(node.proto);
  }

  if (node instanceof FunctionPrototype) {
    return getFunctionSignature(node);
  }

  if (node instanceof TypedefDeclaration) {
    const name = getNodeName(node) ?? '?';
    return `typedef ${name}`;
  }

  if (node instanceof AnnotationDecl) {
    const name = node.name?.id ?? '?';
    return `annotation ${name}`;
  }

  if (node instanceof PackageScope) {
    const path = node.id.map(e => e.id).join('::');
    return `package ${path}`;
  }

  if (node instanceof ActivityDecl) {
    return 'activity';
  }

  return null;
}

/**
 * If the cursor is on a type reference (field type, activity traversal target),
 * resolve it to the declaration AST node so we can show its signature and doc
 * comment instead of the local node's info.
 */
function resolveTypeRefForHover(
  node: ScopeChild,
  position: SourcePosition,
  root: RootSymbolScope,
): ScopeChild | null {
  let typeId: TypeIdentifier | null = null;

  if (node instanceof Field && node.type instanceof DataTypeUserDefined) {
    typeId = node.type.type_id;
  } else if (node instanceof FieldCompRef && node.type) {
    typeId = node.type.type_id;
  } else if (node instanceof FieldRef && node.type) {
    typeId = node.type.type_id;
  } else if (node instanceof FieldClaim && node.type) {
    typeId = node.type.type_id;
  } else if (node instanceof ActionHandleField && node.type instanceof DataTypeUserDefined) {
    typeId = node.type.type_id;
  } else if (node instanceof ActivityActionTypeTraversal && node.target) {
    typeId = node.target.type_id;
  }

  if (!typeId) return null;

  return resolveTypeAtPosition(typeId, position, root);
}

function getFunctionSignature(proto: FunctionPrototype): string {
  const name = proto.name?.id ?? '?';
  const rtype = getDataTypeName(proto.rtype);
  const params = proto.parameters.map(p => {
    const pName = p.name?.id ?? '?';
    const pType = getDataTypeName(p.type);
    return `${pType} ${pName}`;
  }).join(', ');
  return `function ${rtype} ${name}(${params})`;
}

function getDataTypeName(dt: unknown): string {
  if (!dt) return 'void';
  if (dt instanceof DataTypeBool) return 'bool';
  if (dt instanceof DataTypeInt) {
    const sign = dt.is_signed ? 'int' : 'bit';
    return `${sign}`;
  }
  if (dt instanceof DataTypeString) return 'string';
  if (dt instanceof DataTypeUserDefined) {
    return dt.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
  }
  return '?';
}

function getTypeInfo(node: ScopeChild): string | null {
  if (node instanceof Field && node.type) {
    const rand = (node.attr & flags.FieldAttr.Rand) ? 'rand ' : '';
    const constMod = (node.attr & flags.FieldAttr.Const) ? 'const ' : '';
    return `${constMod}${rand}${getDataTypeName(node.type)}`;
  }
  return null;
}

function getLocationInfo(node: ScopeChild, index: WorkspaceIndex, currentUri: string): string | null {
  const loc = node.location;
  if (loc.fileid < 0) return null;

  const fileUri = index.getUriForFileId(loc.fileid);
  if (fileUri && fileUri !== currentUri) {
    return `*Defined in ${fileUri}*`;
  }
  return null;
}
