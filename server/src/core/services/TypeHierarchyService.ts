import {
  ScopeChild,
  Scope,
  TypeScope,
  Action,
  Component,
  Struct,
  Monitor,
  ExtendType,
  GlobalScope,
  SymbolScope,
  SymbolTypeScope,
  RootSymbolScope,
} from '../ast/generated';
import { SourcePosition } from '../types/SourcePosition';
import { SourceRange } from '../types/SourceRange';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { findNodeAtPosition, getNodeName, walkScope } from '../ast/ASTUtils';

export interface TypeHierarchyItem {
  name: string;
  kind: string;
  uri: string;
  range: SourceRange;
  selectionRange: SourceRange;
  detail?: string;
}

/**
 * Prepare a type hierarchy item at the given position.
 */
export function prepareTypeHierarchy(
  uri: string,
  position: SourcePosition,
  index: WorkspaceIndex,
): TypeHierarchyItem | null {
  const ast = index.getAST(uri);
  if (!ast) return null;

  const node = findNodeAtPosition(ast, position);
  if (!node || !(node instanceof TypeScope)) return null;

  const name = node.name?.id ?? '?';
  const loc = node.location;
  if (loc.lineno < 0) return null;

  return {
    name,
    kind: getTypeKindString(node),
    uri,
    range: makeRange(loc),
    selectionRange: makeRange(loc),
  };
}

/**
 * Supertypes: walk the super_t chain upward.
 */
export function getSupertypes(
  item: TypeHierarchyItem,
  index: WorkspaceIndex,
): TypeHierarchyItem[] {
  const results: TypeHierarchyItem[] = [];
  const analysis = index.getAnalysisResult();
  if (!analysis) return results;

  // Find the type scope
  const typeNode = findTypeByName(item.name, index);
  if (!typeNode || !(typeNode instanceof TypeScope)) return results;

  // Walk super chain
  let current: TypeScope | null = typeNode;
  const visited = new Set<string>();
  visited.add(item.name);

  while (current?.super_t) {
    const superName = current.super_t.elems.map(e => e.id?.id).join('::');
    if (visited.has(superName)) break; // circular
    visited.add(superName);

    const superNode = findTypeByName(superName, index);
    if (!superNode || !(superNode instanceof TypeScope)) break;

    const loc = superNode.location;
    if (loc.lineno >= 0) {
      const fileUri = index.getUriForFileId(loc.fileid) ?? '';
      results.push({
        name: superName,
        kind: getTypeKindString(superNode),
        uri: fileUri,
        range: makeRange(loc),
        selectionRange: makeRange(loc),
      });
    }

    current = superNode;
  }

  return results;
}

/**
 * Subtypes: scan all files for types that extend or inherit from this type.
 */
export function getSubtypes(
  item: TypeHierarchyItem,
  index: WorkspaceIndex,
): TypeHierarchyItem[] {
  const results: TypeHierarchyItem[] = [];

  for (const fileUri of index.getFileUris()) {
    const ast = index.getAST(fileUri);
    if (!ast) continue;

    for (const child of walkScope(ast)) {
      // Check inheritance
      if (child instanceof TypeScope && child.super_t) {
        const superName = child.super_t.elems.map(e => e.id?.id).join('::');
        if (superName === item.name) {
          const name = child.name?.id ?? '?';
          const loc = child.location;
          if (loc.lineno >= 0) {
            results.push({
              name,
              kind: getTypeKindString(child),
              uri: fileUri,
              range: makeRange(loc),
              selectionRange: makeRange(loc),
            });
          }
        }
      }

      // Check extend type
      if (child instanceof ExtendType && child.target) {
        const targetName = child.target.elems.map(e => e.id?.id).join('::');
        if (targetName === item.name) {
          const loc = child.location;
          if (loc.lineno >= 0) {
            results.push({
              name: `extend ${item.name}`,
              kind: 'extension',
              uri: fileUri,
              range: makeRange(loc),
              selectionRange: makeRange(loc),
              detail: 'type extension',
            });
          }
        }
      }
    }
  }

  return results;
}

function findTypeByName(name: string, index: WorkspaceIndex): ScopeChild | null {
  for (const fileUri of index.getFileUris()) {
    const ast = index.getAST(fileUri);
    if (!ast) continue;

    for (const child of walkScope(ast)) {
      if (child instanceof TypeScope && child.name?.id === name) {
        return child;
      }
    }
  }
  return null;
}

function getTypeKindString(node: TypeScope): string {
  if (node instanceof Action) return 'action';
  if (node instanceof Component) return 'component';
  if (node instanceof Struct) return node.kind !== undefined ? 'struct' : 'struct';
  if (node instanceof Monitor) return 'monitor';
  return 'type';
}

function makeRange(loc: { lineno: number; linepos: number; extent: number }): SourceRange {
  return {
    start: { line: loc.lineno - 1, character: loc.linepos },
    end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : 1) },
  };
}
