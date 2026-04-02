import {
  SymbolScope,
  SymbolTypeScope,
  SymbolEnumScope,
  SymbolFunctionScope,
  RootSymbolScope,
} from '../ast/generated';

/**
 * Levenshtein edit distance between two strings.
 * Optimised with a single-row DP array.
 */
export function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Previous row of distances
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);

  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,          // deletion
        prev[j - 1] + cost,   // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

/**
 * Collect all symbol names reachable from a root scope.
 * Returns a flat list of unqualified names.
 */
export function collectAllSymbolNames(root: RootSymbolScope): string[] {
  const names: string[] = [];
  collectNames(root, names);
  return names;
}

function collectNames(scope: SymbolScope, names: string[]): void {
  for (const [name, idx] of scope.symtab) {
    names.push(name);
    const child = scope.children[idx];
    if (child instanceof SymbolScope && !(child instanceof RootSymbolScope)) {
      collectNames(child, names);
    }
  }
}

/**
 * Find the best matching symbol name for a given unknown name.
 * Returns the suggestion or null if nothing is close enough.
 *
 * Threshold: distance <= max(2, floor(name.length / 3))
 * This keeps short names strict (edit distance <= 2) while
 * allowing more tolerance for longer identifiers.
 */
export function findBestMatch(unknown: string, candidates: string[]): string | null {
  const maxDist = Math.max(2, Math.floor(unknown.length / 3));
  let bestName: string | null = null;
  let bestDist = maxDist + 1;

  const lowerUnknown = unknown.toLowerCase();

  for (const cand of candidates) {
    // Quick length check to skip obvious non-matches
    if (Math.abs(cand.length - unknown.length) > maxDist) continue;

    const dist = levenshtein(lowerUnknown, cand.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      bestName = cand;
    }
  }

  return bestDist <= maxDist ? bestName : null;
}
