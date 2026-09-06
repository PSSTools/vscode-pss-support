import { GlobalScope, ActivityDecl } from '../ast/generated';
import { walkScope } from '../ast/ASTUtils';

/**
 * Find the ActivityDecl a given 0-based line falls within.
 *
 * The AST records only a start location per node, so containment is
 * approximated by choosing the last activity that starts at or before the line.
 * That beats the previous fixed 20-line window, which both missed longer
 * activities and claimed lines well past the end of shorter ones.
 */
export function findActivityAtLine(ast: GlobalScope, line: number): ActivityDecl | null {
  let best: ActivityDecl | null = null;
  let bestLine = -1;

  for (const node of walkScope(ast)) {
    if (!(node instanceof ActivityDecl)) continue;
    const startLine = node.location.lineno - 1;
    if (startLine <= line && startLine > bestLine) {
      best = node;
      bestLine = startLine;
    }
  }

  return best;
}
