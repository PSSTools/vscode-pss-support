import {
  ScopeChild,
  Scope,
  TypeScope,
  NamedScope,
  NamedScopeChild,
  Field,
  FieldCompRef,
  FieldRef,
  FieldClaim,
  ActionHandleField,
  DataTypeUserDefined,
  DataTypeEnum,
  DataTypeRef,
  TypeIdentifier,
  GlobalScope,
  PackageScope,
  ExtendType,
  ActivityActionTypeTraversal,
  SymbolScope,
  RootSymbolScope,
} from '../ast/generated';
import { SourcePosition } from '../types/SourcePosition';
import { SourceRange } from '../types/SourceRange';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { findNodeAtPosition, getNodeName, walkScope } from '../ast/ASTUtils';

export interface ReferenceResult {
  uri: string;
  range: SourceRange;
  isDeclaration: boolean;
}

/**
 * Find all references to the symbol at the given position across
 * the workspace. Scans all files' ASTs for type identifiers and
 * field references matching the declaration.
 */
export function getReferences(
  uri: string,
  position: SourcePosition,
  index: WorkspaceIndex,
  includeDeclaration: boolean = true,
): ReferenceResult[] {
  const ast = index.getAST(uri);
  if (!ast) return [];

  const node = findNodeAtPosition(ast, position);
  if (!node) return [];

  const name = getDeclarationName(node);
  if (!name) return [];

  const results: ReferenceResult[] = [];

  // If including declaration, add the declaration itself
  if (includeDeclaration) {
    const declNode = getDeclarationNode(node);
    if (declNode) {
      const loc = declNode.location;
      if (loc.lineno >= 0) {
        const fileUri = index.getUriForFileId(loc.fileid) ?? uri;
        results.push({
          uri: fileUri,
          range: {
            start: { line: loc.lineno - 1, character: loc.linepos },
            end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : name.length) },
          },
          isDeclaration: true,
        });
      }
    }
  }

  // Scan all files for references
  for (const fileUri of index.getFileUris()) {
    const fileAst = index.getAST(fileUri);
    if (!fileAst) continue;
    collectReferences(fileAst, fileUri, name, results, index);
  }

  return results;
}

function getDeclarationName(node: ScopeChild): string | null {
  if (node instanceof NamedScope) return node.name?.id ?? null;
  if (node instanceof NamedScopeChild) return node.name?.id ?? null;
  if (node instanceof PackageScope) {
    return node.id.map(e => e.id).join('::');
  }
  return null;
}

function getDeclarationNode(node: ScopeChild): ScopeChild {
  return node;
}

function collectReferences(
  scope: Scope,
  uri: string,
  targetName: string,
  results: ReferenceResult[],
  index: WorkspaceIndex,
): void {
  for (const child of scope.children) {
    // Check type references in fields
    checkFieldTypeReference(child, uri, targetName, results);

    // Check super type references
    checkSuperTypeReference(child, uri, targetName, results);

    // Check extend type references
    checkExtendReference(child, uri, targetName, results);

    // Check activity traversal references
    checkActivityTraversalReference(child, uri, targetName, results);

    // Recurse into scopes
    if (child instanceof Scope) {
      collectReferences(child, uri, targetName, results, index);
    }
  }
}

function checkFieldTypeReference(
  node: ScopeChild,
  uri: string,
  targetName: string,
  results: ReferenceResult[],
): void {
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
  }

  if (typeId) {
    addTypeIdReference(typeId, uri, targetName, results);
  }

  // Also check DataTypeEnum and DataTypeRef
  if (node instanceof Field) {
    if (node.type instanceof DataTypeEnum && node.type.tid?.type_id) {
      addTypeIdReference(node.type.tid.type_id, uri, targetName, results);
    }
    if (node.type instanceof DataTypeRef && node.type.type?.type_id) {
      addTypeIdReference(node.type.type.type_id, uri, targetName, results);
    }
  }
}

function checkSuperTypeReference(
  node: ScopeChild,
  uri: string,
  targetName: string,
  results: ReferenceResult[],
): void {
  if (node instanceof TypeScope && node.super_t) {
    addTypeIdReference(node.super_t, uri, targetName, results);
  }
}

function checkExtendReference(
  node: ScopeChild,
  uri: string,
  targetName: string,
  results: ReferenceResult[],
): void {
  if (node instanceof ExtendType && node.target) {
    addTypeIdReference(node.target, uri, targetName, results);
  }
}

function checkActivityTraversalReference(
  node: ScopeChild,
  uri: string,
  targetName: string,
  results: ReferenceResult[],
): void {
  if (node instanceof ActivityActionTypeTraversal && node.target?.type_id) {
    addTypeIdReference(node.target.type_id, uri, targetName, results);
  }
}

function addTypeIdReference(
  typeId: TypeIdentifier,
  uri: string,
  targetName: string,
  results: ReferenceResult[],
): void {
  const refName = typeId.elems.map(e => e.id?.id ?? '').join('::');
  // Match if the reference name matches or ends with the target name
  if (refName === targetName || refName.endsWith('::' + targetName)) {
    const firstElem = typeId.elems[0];
    const loc = firstElem?.id?.location;
    if (loc && loc.lineno >= 0) {
      results.push({
        uri,
        range: {
          start: { line: loc.lineno - 1, character: loc.linepos },
          end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : refName.length) },
        },
        isDeclaration: false,
      });
    }
  }
}
