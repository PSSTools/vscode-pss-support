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
  DataTypeUserDefined,
  DataTypeEnum,
  DataTypeRef,
  TypeIdentifier,
  TypeIdentifierElem,
  PackageScope,
  PackageImportStmt,
  EnumDecl,
  FunctionDefinition,
  ExprRefPathContext,
  ExprRefPathStatic,
  ExprRefPathStaticRooted,
  ExprRefPathSuper,
  ActivityActionTypeTraversal,
  SymbolScope,
  RootSymbolScope,
} from '../ast/generated';
import { DefinitionResult } from '../types/DefinitionResult';
import { SourcePosition } from '../types/SourcePosition';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { findNodeAtPosition, getNodeName } from '../ast/ASTUtils';
import { findSymbolScope, resolveTypeAtPosition } from '../analysis/SymbolLookup';

/**
 * Given a position in a file, find the declaration location of the
 * symbol under the cursor. Supports type references, field references,
 * super type navigation, imports, and activity traversals.
 */
export function getDefinition(
  uri: string,
  position: SourcePosition,
  index: WorkspaceIndex,
): DefinitionResult[] {
  const ast = index.getAST(uri);
  if (!ast) return [];

  const node = findNodeAtPosition(ast, position);
  if (!node) return [];

  const analysisResult = index.getAnalysisResult();
  if (!analysisResult) return [];

  const results: DefinitionResult[] = [];

  // If the node itself is a declaration, navigate to it
  if (isDeclaration(node)) {
    const loc = node.location;
    if (loc.lineno >= 0) {
      const fileUri = index.getUriForFileId(loc.fileid) ?? uri;
      results.push({
        uri: fileUri,
        range: {
          start: { line: loc.lineno - 1, character: loc.linepos },
          end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : 1) },
        },
      });
    }
    return results;
  }

  // Try to resolve type references
  const typeResult = resolveTypeReference(node, position, analysisResult.root, index);
  if (typeResult) {
    results.push(typeResult);
    return results;
  }

  // Try field type references
  const fieldResult = resolveFieldTypeReference(node, analysisResult.root, index);
  if (fieldResult) {
    results.push(fieldResult);
    return results;
  }

  // Try super type references
  const superResult = resolveSuperTypeReference(node, analysisResult.root, index);
  if (superResult) {
    results.push(superResult);
    return results;
  }

  return results;
}

function isDeclaration(node: ScopeChild): boolean {
  return (
    node instanceof TypeScope ||
    node instanceof PackageScope ||
    node instanceof EnumDecl ||
    node instanceof FunctionDefinition
  );
}

function resolveTypeReference(
  node: ScopeChild,
  position: SourcePosition,
  root: RootSymbolScope,
  index: WorkspaceIndex,
): DefinitionResult | null {
  // Fields with user-defined types
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

  return resolveTypeIdentifierAtPosition(typeId, position, root, index);
}

function resolveFieldTypeReference(
  node: ScopeChild,
  root: RootSymbolScope,
  index: WorkspaceIndex,
): DefinitionResult | null {
  if (node instanceof Field) {
    if (node.type instanceof DataTypeEnum && node.type.tid) {
      return resolveTypeIdentifierToDefinition(node.type.tid.type_id!, root, index);
    }
    if (node.type instanceof DataTypeRef && node.type.type) {
      return resolveTypeIdentifierToDefinition(node.type.type.type_id!, root, index);
    }
  }
  return null;
}

function resolveSuperTypeReference(
  node: ScopeChild,
  root: RootSymbolScope,
  index: WorkspaceIndex,
): DefinitionResult | null {
  if (node instanceof TypeScope && node.super_t) {
    return resolveTypeIdentifierToDefinition(node.super_t, root, index);
  }
  return null;
}

function resolveTypeIdentifierAtPosition(
  typeId: TypeIdentifier,
  position: SourcePosition,
  root: RootSymbolScope,
  index: WorkspaceIndex,
): DefinitionResult | null {
  const target = resolveTypeAtPosition(typeId, position, root);
  if (!target) return null;

  const loc = target.location;
  if (!loc || loc.lineno < 0) return null;

  const fileUri = index.getUriForFileId(loc.fileid);
  if (!fileUri) return null;

  return {
    uri: fileUri,
    range: {
      start: { line: loc.lineno - 1, character: loc.linepos },
      end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : 1) },
    },
  };
}

function resolveTypeIdentifierToDefinition(
  typeId: TypeIdentifier,
  root: RootSymbolScope,
  index: WorkspaceIndex,
): DefinitionResult | null {
  if (!typeId || typeId.elems.length === 0) return null;

  const name = typeId.elems.map(e => e.id?.id ?? '').join('::');
  const scope = findSymbolScope(name, root);
  if (!scope?.target) return null;

  const target = scope.target as ScopeChild;
  const loc = target.location;
  if (!loc || loc.lineno < 0) return null;

  const fileUri = index.getUriForFileId(loc.fileid);
  if (!fileUri) return null;

  return {
    uri: fileUri,
    range: {
      start: { line: loc.lineno - 1, character: loc.linepos },
      end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : 1) },
    },
  };
}
