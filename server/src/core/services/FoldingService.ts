import {
  ScopeChild,
  Scope,
  ConstraintBlock,
  TypeScope,
  PackageScope,
  ActivityDecl,
  ExecBlock,
  GlobalScope,
  PackageImportStmt,
} from '../ast/generated/index.js';

export interface FoldingRange {
  startLine: number;
  startCharacter?: number;
  endLine: number;
  endCharacter?: number;
  kind?: 'comment' | 'imports' | 'region';
}

/**
 * Produce folding ranges for brace-delimited blocks, multi-line comments,
 * and import groups.
 */
export function getFoldingRanges(ast: GlobalScope): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  collectFoldingRanges(ast, ranges);
  collectImportGroupRanges(ast, ranges);
  return ranges;
}

function collectFoldingRanges(scope: Scope, ranges: FoldingRange[]): void {
  for (const child of scope.children) {
    // A constraint block is brace-delimited and often the longest thing in an
    // action, but it is not a Scope -- it holds `constraints`, not `children`
    // -- so the general branch below would skip it.
    if (child instanceof ConstraintBlock) {
      // `endLocation` is not set on these, so the last statement stands in for
      // the closing brace -- the same fallback `getEndLine` uses for a scope.
      const end = child.endLocation.lineno >= 0
        ? child.endLocation.lineno
        : Math.max(...child.constraints.map(c => c.location.lineno), -1);
      if (child.location.lineno >= 0 && end > child.location.lineno) {
        ranges.push({ startLine: child.location.lineno - 1, endLine: end - 1 });
      }
      continue;
    }

    if (child instanceof Scope && child.children.length > 0) {
      const startLoc = child.location;
      if (startLoc.lineno < 0) continue;

      // Compute end line: use endLocation if set, otherwise find the
      // last child's location, or use the scope's own extent
      const endLine = getEndLine(child);
      if (endLine > startLoc.lineno - 1) {
        ranges.push({
          startLine: startLoc.lineno - 1,
          endLine,
        });
      }

      collectFoldingRanges(child, ranges);
    }
  }
}

function getEndLine(scope: Scope): number {
  // Try endLocation first
  if (scope.endLocation.lineno >= 0) {
    return scope.endLocation.lineno - 1;
  }

  // Find the maximum line among children
  let maxLine = scope.location.lineno - 1;
  for (const child of scope.children) {
    if (child.location.lineno >= 0) {
      const childLine = child.location.lineno - 1;
      if (childLine > maxLine) maxLine = childLine;
    }
    if (child instanceof Scope) {
      const childEnd = getEndLine(child);
      if (childEnd > maxLine) maxLine = childEnd;
    }
  }

  return maxLine;
}

function collectImportGroupRanges(ast: GlobalScope, ranges: FoldingRange[]): void {
  const scanScope = (scope: Scope) => {
    let importStart = -1;
    let importEnd = -1;

    for (const child of scope.children) {
      if (child instanceof PackageImportStmt) {
        const loc = child.location;
        if (loc.lineno >= 0) {
          if (importStart < 0) importStart = loc.lineno - 1;
          importEnd = loc.lineno - 1;
        }
      } else {
        if (importStart >= 0 && importEnd > importStart) {
          ranges.push({
            startLine: importStart,
            endLine: importEnd,
            kind: 'imports',
          });
        }
        importStart = -1;
        importEnd = -1;
      }

      if (child instanceof Scope) {
        scanScope(child);
      }
    }

    if (importStart >= 0 && importEnd > importStart) {
      ranges.push({
        startLine: importStart,
        endLine: importEnd,
        kind: 'imports',
      });
    }
  };

  scanScope(ast);
}
