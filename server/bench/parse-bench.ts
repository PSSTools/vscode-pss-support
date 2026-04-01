import { bench, describe } from 'vitest';
import { PSSParserFacade } from '../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../src/core/parser/PSSASTBuilder';

function generatePSS(lines: number): string {
  const parts: string[] = ['package bench_pkg {'];
  let lineCount = 1;

  let actionIdx = 0;
  while (lineCount < lines) {
    const actionName = `action_${actionIdx++}`;
    parts.push(`  action ${actionName} {`);
    lineCount++;

    // Add fields
    for (let f = 0; f < 5 && lineCount < lines; f++) {
      parts.push(`    rand bit[32] field_${f};`);
      lineCount++;
    }

    // Add a constraint
    if (lineCount < lines) {
      parts.push(`    constraint c {`);
      parts.push(`      field_0 > 0;`);
      parts.push(`      field_1 < 100;`);
      parts.push(`    }`);
      lineCount += 4;
    }

    // Add activity
    if (lineCount < lines) {
      parts.push(`    activity {`);
      parts.push(`    }`);
      lineCount += 2;
    }

    parts.push(`  }`);
    lineCount++;
  }

  parts.push('}');
  return parts.join('\n');
}

const parser = new PSSParserFacade();

describe('Parse Benchmarks', () => {
  const src1k = generatePSS(1000);
  const src5k = generatePSS(5000);
  const src10k = generatePSS(10000);

  bench('parse 1K lines', () => {
    parser.parse(src1k, 1);
  });

  bench('parse 5K lines', () => {
    parser.parse(src5k, 2);
  });

  bench('parse 10K lines', () => {
    parser.parse(src10k, 3);
  });

  bench('parse + AST build 1K lines', () => {
    const result = parser.parse(src1k, 4);
    const builder = new PSSASTBuilder(4, result.tokens);
    builder.build(result.tree);
  });

  bench('parse + AST build 5K lines', () => {
    const result = parser.parse(src5k, 5);
    const builder = new PSSASTBuilder(5, result.tokens);
    builder.build(result.tree);
  });
});
