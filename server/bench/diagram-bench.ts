import { bench, describe } from 'vitest';
import { parseSource } from '../test/helpers/ParseHelper.js';
import { ActivityDiagramBuilder } from '../src/core/diagram/ActivityDiagramBuilder.js';
import { ActivityDecl } from '../src/core/ast/generated/index.js';
import { walkScope } from '../src/core/ast/ASTUtils.js';

function generateActivity(actionCount: number): string {
  const lines = ['component c {'];
  for (let i = 0; i < actionCount; i++) {
    lines.push(`  action a${i} { }`);
  }
  lines.push('  action main {');
  lines.push('    activity {');
  for (let i = 0; i < actionCount; i++) {
    lines.push(`      do a${i};`);
  }
  lines.push('    }');
  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}

function buildActivity(source: string): ActivityDecl | null {
  const ast = parseSource(source)!;
  for (const child of walkScope(ast)) {
    if (child instanceof ActivityDecl) return child;
  }
  return null;
}

describe('Diagram Benchmarks', () => {
  const act10 = buildActivity(generateActivity(10))!;
  const act50 = buildActivity(generateActivity(50))!;
  const act200 = buildActivity(generateActivity(200))!;

  bench('diagram build - 10 nodes', () => {
    if (act10) new ActivityDiagramBuilder().build(act10);
  });

  bench('diagram build - 50 nodes', () => {
    if (act50) new ActivityDiagramBuilder().build(act50);
  });

  bench('diagram build - 200 nodes', () => {
    if (act200) new ActivityDiagramBuilder().build(act200);
  });
});
