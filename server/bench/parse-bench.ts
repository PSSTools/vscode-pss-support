import { bench, describe } from 'vitest';
import { newParser } from '../src/core/parser/ParserHost.js';

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

/**
 * A fresh parser per iteration.
 *
 * Sessions accumulate parsed units, so reusing one would measure a workspace
 * growing without bound rather than the cost of parsing the source once.
 *
 * "parse" and "AST build" are no longer separable, which is why those variants
 * are gone: the tree is materialised out of the wire format during `link()`,
 * so the honest split is parse-only against parse-and-link.
 */
function parseOnly(src: string): void {
  const parser = newParser();
  try {
    parser.parseSources([{ name: 'bench.pss', content: src }]);
  } finally {
    parser.dispose();
  }
}

function parseAndLink(src: string): void {
  const parser = newParser();
  try {
    parser.parseSources([{ name: 'bench.pss', content: src }]);
    parser.link();
  } finally {
    parser.dispose();
  }
}

describe('Parse Benchmarks', () => {
  const src1k = generatePSS(1000);
  const src5k = generatePSS(5000);
  const src10k = generatePSS(10000);

  bench('parse 1K lines', () => parseOnly(src1k));
  bench('parse 5K lines', () => parseOnly(src5k));
  bench('parse 10K lines', () => parseOnly(src10k));

  bench('parse + link 1K lines', () => parseAndLink(src1k));
  bench('parse + link 5K lines', () => parseAndLink(src5k));
});
