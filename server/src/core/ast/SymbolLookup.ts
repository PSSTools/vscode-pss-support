/**
 * Queries over the linked symbol table.
 *
 * Lives beside the AST rather than under an `analysis/` directory because it
 * performs none: the parser's `link()` builds the tree and resolves the
 * references, and these two functions only look things up in the result.
 */
import {
  ScopeChild,
  SymbolScope,
  RootSymbolScope,
  TypeIdentifier,
} from './generated/index.js';
import { SourcePosition } from '../types/SourcePosition.js';
import { lspChar } from './SourceLoc.js';

/**
 * Resolve a qualified name (e.g. "mycomp_c::A") to its SymbolScope
 * in the symbol tree.
 */
export function findSymbolScope(name: string, root: RootSymbolScope): SymbolScope | null {
  const parts = name.split('::');

  let found = lookupPath(parts, root);
  if (found) return found;

  for (const [, idx] of root.symtab) {
    const pkg = root.children[idx];
    if (pkg instanceof SymbolScope) {
      if (parts.length === 1 && pkg.symtab.has(parts[0])) {
        const childIdx = pkg.symtab.get(parts[0])!;
        const child = pkg.children[childIdx];
        if (child instanceof SymbolScope) return child;
      }
      found = lookupPath(parts, pkg);
      if (found) return found;
    }
  }

  return null;
}

function lookupPath(parts: string[], scope: SymbolScope): SymbolScope | null {
  let current: SymbolScope = scope;
  for (const part of parts) {
    if (!current.symtab.has(part)) return null;
    const idx = current.symtab.get(part)!;
    const child = current.children[idx];
    if (!(child instanceof SymbolScope)) return null;
    current = child;
  }
  return current;
}

/**
 * Given a TypeIdentifier and a cursor position, determine which element
 * the cursor is on and resolve the path prefix up to that element.
 * Returns the target AST node (the declaration) or null.
 */
export function resolveTypeAtPosition(
  typeId: TypeIdentifier,
  position: SourcePosition,
  root: RootSymbolScope,
): ScopeChild | null {
  if (!typeId || typeId.elems.length === 0) return null;

  let elemCount = typeId.elems.length;
  for (let i = 0; i < typeId.elems.length; i++) {
    const elem = typeId.elems[i];
    const loc = elem.id?.location;
    if (!loc || loc.lineno < 0) continue;
    const elemLine = loc.lineno - 1;
    const elemStart = lspChar(loc);
    const elemEnd = elemStart + (loc.extent > 0 ? loc.extent : (elem.id?.id?.length ?? 1));
    if (position.line === elemLine && position.character >= elemStart && position.character < elemEnd) {
      elemCount = i + 1;
      break;
    }
  }

  const resolveElems = typeId.elems.slice(0, elemCount);
  const name = resolveElems.map(e => e.id?.id ?? '').join('::');
  const scope = findSymbolScope(name, root);
  return scope ? declarationOf(scope) : null;
}

/**
 * The node standing for a symbol scope's declaration.
 *
 * Usually `target`, the declaration the scope was built from. An enum scope
 * has none, deliberately: `target` is a traversal edge in the core, so
 * pointing it at the EnumDecl made visitors descend into the declaration a
 * second time from inside the enum and broke resolution of the enum's own
 * base type. The scope carries the declaration's location anyway -- the core
 * copies the extent onto it -- so for anything that wants to navigate to or
 * describe the declaration, the scope itself stands in perfectly well.
 */
export function declarationOf(scope: SymbolScope): ScopeChild {
  return (scope.target as ScopeChild | null) ?? scope;
}
