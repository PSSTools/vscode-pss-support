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
} from './generated/index.js';
import { SourcePosition } from '../types/SourcePosition.js';
import { lspChar } from './SourceLoc.js';

/**
 * Find the deepest AST node at a given source position.
 *
 * A node's `location` is its declared *name*, not the start of its
 * declaration: `rand my_s payload;` reports the column of `payload`. So a
 * node claims the text running back to the end of its previous sibling as
 * well as the name itself -- otherwise a cursor on `my_s`, which is where a
 * user asking for the definition of a type puts it, falls to the enclosing
 * component and resolves to the wrong thing entirely.
 *
 * The claim is leftward only, never crosses a line, and never crosses the
 * start of the enclosing declaration. `struct s { int x; }` written on one
 * line therefore leaves `s` to the struct rather than handing the whole line
 * to `x`, while `int x;` on a line of its own claims the qualifiers and type
 * in front of it.
 */
export function findNodeAtPosition(root: Scope, pos: SourcePosition): ScopeChild | null {
  let best: ScopeChild | null = null;

  function visit(node: ScopeChild, prevSiblingEndChar: number): void {
    const loc = node.location;
    if (loc.lineno < 0) return;

    const nodeStartLine = loc.lineno - 1; // Convert 1-indexed to 0-indexed
    const nodeStartChar = lspChar(loc);
    const claimFrom = Math.min(nodeStartChar, Math.max(prevSiblingEndChar, 0));

    // Check if position is at or after this node's start
    if (pos.line > nodeStartLine || (pos.line === nodeStartLine && pos.character >= claimFrom)) {
      best = node;
    }

    // Recurse into children if node is a scope
    if (node instanceof Scope) {
      visitSiblings(node.children, nodeStartLine);
    } else if (node instanceof SymbolChildrenScope && node.children.length > 0) {
      // ActivityDecl and similar SymbolScope subclasses hold AST children
      // but do not extend Scope; recurse into them as well.
      visitSiblings(node.children, nodeStartLine);
    }
  }

  /**
   * Walk a child list, telling each node where its leftward claim must stop.
   *
   * Three cases, in order: a previous sibling on the same line stops the
   * claim at its end, so `int a; int b;` splits between them; sharing a line
   * with the parent's own declaration stops it dead, so the parent keeps its
   * name; otherwise the node has the line to itself and claims all of it.
   */
  function visitSiblings(children: ScopeChild[], parentStartLine: number): void {
    let prevEndLine = -1;
    let prevEndChar = 0;
    for (const child of children) {
      const loc = child.location;
      if (loc.lineno < 0) continue;
      const line = loc.lineno - 1;
      const claimFrom = line === prevEndLine ? prevEndChar
        : line === parentStartLine ? lspChar(loc)
        : 0;
      visit(child, claimFrom);
      const end = child.endLocation;
      if (end.lineno >= 0) {
        prevEndLine = end.lineno - 1;
        prevEndChar = lspChar(end) + 1;
      } else {
        prevEndLine = line;
        prevEndChar = lspChar(loc) + Math.max(loc.extent, 1);
      }
    }
  }

  visitSiblings(root.children, -1);

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
