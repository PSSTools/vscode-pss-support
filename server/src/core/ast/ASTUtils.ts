import {
  Scope,
  ScopeChild,
  NamedScope,
  NamedScopeChild,
  Action,
  Component,
  Struct,
  Field,
  ExprId,
  GlobalScope,
  PackageScope,
  TypeScope,
  enums,
  flags,
  SymbolChildrenScope,
} from './generated';
import { SourcePosition } from '../types/SourcePosition';

/**
 * Find the deepest AST node at a given source position.
 */
export function findNodeAtPosition(root: Scope, pos: SourcePosition): ScopeChild | null {
  let best: ScopeChild | null = null;

  function visit(node: ScopeChild): void {
    const loc = node.location;
    if (loc.lineno < 0) return;

    const nodeStartLine = loc.lineno - 1; // Convert 1-indexed to 0-indexed
    const nodeStartChar = loc.linepos;

    // Check if position is at or after this node's start
    if (pos.line > nodeStartLine || (pos.line === nodeStartLine && pos.character >= nodeStartChar)) {
      best = node;
    }

    // Recurse into children if node is a scope
    if (node instanceof Scope) {
      for (const child of node.children) {
        visit(child);
      }
    } else if (node instanceof SymbolChildrenScope && node.children.length > 0) {
      // ActivityDecl and similar SymbolScope subclasses hold AST children
      // but do not extend Scope; recurse into them as well.
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  for (const child of root.children) {
    visit(child);
  }

  return best;
}

/**
 * Depth-first iterator over all nodes in a scope.
 */
export function* walkScope(scope: Scope): Generator<ScopeChild> {
  for (const child of scope.children) {
    yield child;
    if (child instanceof Scope) {
      yield* walkScope(child);
    } else if (child instanceof SymbolChildrenScope && child.children.length > 0) {
      // SymbolChildrenScope (e.g. ActivityDecl) has children but is not Scope
      yield* walkSymbolScope(child);
    }
  }
}

function* walkSymbolScope(scope: SymbolChildrenScope): Generator<ScopeChild> {
  for (const child of scope.children) {
    yield child;
    if (child instanceof Scope) {
      yield* walkScope(child);
    } else if (child instanceof SymbolChildrenScope && child.children.length > 0) {
      yield* walkSymbolScope(child);
    }
  }
}

/**
 * Get the name string from a named scope or named scope child.
 */
export function getNodeName(node: ScopeChild): string | null {
  if (node instanceof NamedScope) {
    return node.name?.id ?? null;
  }
  if (node instanceof NamedScopeChild) {
    return node.name?.id ?? null;
  }
  return null;
}

/**
 * Get a human-readable signature string for a node.
 */
export function getNodeSignature(node: ScopeChild): string {
  if (node instanceof Action) {
    const name = node.name?.id ?? '?';
    const abs = node.is_abstract ? 'abstract ' : '';
    return `${abs}action ${name}`;
  }
  if (node instanceof Component) {
    const name = node.name?.id ?? '?';
    return `component ${name}`;
  }
  if (node instanceof Struct) {
    const name = node.name?.id ?? '?';
    const kind = enums.StructKind[node.kind]?.toLowerCase() ?? 'struct';
    return `${kind} ${name}`;
  }
  if (node instanceof Field) {
    const name = node.name?.id ?? '?';
    const rand = (node.attr & flags.FieldAttr.Rand) ? 'rand ' : '';
    const typeName = getTypeName(node.type);
    return `${rand}${typeName} ${name}`;
  }
  if (node instanceof PackageScope) {
    const parts = node.id.map(e => e.id);
    return `package ${parts.join('::')}`;
  }
  return getNodeName(node) ?? '(unnamed)';
}

function getTypeName(type: unknown): string {
  if (!type) return '?';
  if (typeof type === 'object' && 'id' in (type as any)) {
    return (type as any).id ?? '?';
  }
  return '?';
}

/**
 * Debug dump of the AST tree.
 */
export function prettyPrint(node: ScopeChild, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  const name = getNodeName(node) ?? '';
  const className = node.constructor.name;
  let result = `${prefix}${className}`;
  if (name) result += ` "${name}"`;
  result += '\n';

  if (node instanceof Scope) {
    for (const child of node.children) {
      result += prettyPrint(child, indent + 1);
    }
  }

  return result;
}
