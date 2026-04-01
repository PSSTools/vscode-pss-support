import {
  ScopeChild,
  SymbolScope,
  RootSymbolScope,
  TypeIdentifier,
} from '../ast/generated';
import { SourcePosition } from '../types/SourcePosition';

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
    const elemStart = loc.linepos;
    const elemEnd = elemStart + (loc.extent > 0 ? loc.extent : (elem.id?.id?.length ?? 1));
    if (position.line === elemLine && position.character >= elemStart && position.character < elemEnd) {
      elemCount = i + 1;
      break;
    }
  }

  const resolveElems = typeId.elems.slice(0, elemCount);
  const name = resolveElems.map(e => e.id?.id ?? '').join('::');
  const scope = findSymbolScope(name, root);
  if (!scope?.target) return null;

  return scope.target as ScopeChild;
}
