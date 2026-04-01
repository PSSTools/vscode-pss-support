import {
  ScopeChild,
  Scope,
  Action,
  Component,
  TypeScope,
  ActivityDecl,
  ActivityActionHandleTraversal,
  ActivityActionTypeTraversal,
  GlobalScope,
  SymbolScope,
  SymbolTypeScope,
  RootSymbolScope,
} from '../ast/generated';
import { SourcePosition } from '../types/SourcePosition';
import { SourceRange } from '../types/SourceRange';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { findNodeAtPosition, getNodeName, walkScope } from '../ast/ASTUtils';
import { SymbolChildrenScope } from '../ast/generated';

export interface CallHierarchyItem {
  name: string;
  kind: string;
  uri: string;
  range: SourceRange;
  selectionRange: SourceRange;
}

export interface CallHierarchyCall {
  from: CallHierarchyItem;
  fromRanges: SourceRange[];
}

/**
 * Prepare a call hierarchy item at the given position.
 */
export function prepareCallHierarchy(
  uri: string,
  position: SourcePosition,
  index: WorkspaceIndex,
): CallHierarchyItem | null {
  const ast = index.getAST(uri);
  if (!ast) return null;

  const node = findNodeAtPosition(ast, position);
  if (!node) return null;

  // Only actions participate in the call hierarchy
  if (!(node instanceof Action)) return null;

  const name = node.name?.id ?? '?';
  const loc = node.location;
  if (loc.lineno < 0) return null;

  const range = makeRange(loc);
  return { name, kind: 'action', uri, range, selectionRange: range };
}

/**
 * Outgoing calls: actions traversed by `do` in this action's activity.
 */
export function getOutgoingCalls(
  item: CallHierarchyItem,
  index: WorkspaceIndex,
): CallHierarchyCall[] {
  const calls: CallHierarchyCall[] = [];

  // Find the action's AST
  for (const fileUri of index.getFileUris()) {
    const ast = index.getAST(fileUri);
    if (!ast) continue;

    for (const child of walkScope(ast)) {
      if (child instanceof Action && child.name?.id === item.name) {
        // Scan activity for traversals
        collectTraversals(child, fileUri, index, calls);
      }
    }
  }

  return calls;
}

/**
 * Incoming calls: actions whose activities traverse this action.
 */
export function getIncomingCalls(
  item: CallHierarchyItem,
  index: WorkspaceIndex,
): CallHierarchyCall[] {
  const calls: CallHierarchyCall[] = [];

  for (const fileUri of index.getFileUris()) {
    const ast = index.getAST(fileUri);
    if (!ast) continue;

    for (const child of walkScope(ast)) {
      if (child instanceof Action) {
        const traversals = findTraversalsTo(child, item.name);
        if (traversals.length > 0) {
          const name = child.name?.id ?? '?';
          const loc = child.location;
          if (loc.lineno >= 0) {
            const range = makeRange(loc);
            calls.push({
              from: { name, kind: 'action', uri: fileUri, range, selectionRange: range },
              fromRanges: traversals,
            });
          }
        }
      }
    }
  }

  return calls;
}

function collectTraversals(
  action: Action,
  uri: string,
  index: WorkspaceIndex,
  calls: CallHierarchyCall[],
): void {
  for (const child of walkActionScope(action)) {
    let targetName: string | null = null;
    let loc = child.location;

    if (child instanceof ActivityActionTypeTraversal) {
      targetName = child.target?.type_id?.elems.map(e => e.id?.id).join('::') ?? null;
    } else if (child instanceof ActivityActionHandleTraversal) {
      targetName = child.target?.hier_id?.elems
        ?.map((e: any) => e.id?.id).filter(Boolean).join('.') ?? null;
    }

    if (targetName && loc.lineno >= 0) {
      const range = makeRange(loc);
      calls.push({
        from: { name: targetName, kind: 'action', uri, range, selectionRange: range },
        fromRanges: [range],
      });
    }
  }
}

function findTraversalsTo(action: Action, targetName: string): SourceRange[] {
  const ranges: SourceRange[] = [];

  for (const child of walkActionScope(action)) {
    if (child instanceof ActivityActionTypeTraversal) {
      const name = child.target?.type_id?.elems.map(e => e.id?.id).join('::');
      if (name === targetName && child.location.lineno >= 0) {
        ranges.push(makeRange(child.location));
      }
    }
  }

  return ranges;
}

function* walkActionScope(scope: { children: ScopeChild[] }): Generator<ScopeChild> {
  for (const child of scope.children) {
    yield child;
    if (child instanceof Scope) {
      yield* walkActionScope(child);
    } else if (child instanceof SymbolChildrenScope && child.children.length > 0) {
      yield* walkActionScope(child);
    }
  }
}

function makeRange(loc: { lineno: number; linepos: number; extent: number }): SourceRange {
  return {
    start: { line: loc.lineno - 1, character: loc.linepos },
    end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : 1) },
  };
}
