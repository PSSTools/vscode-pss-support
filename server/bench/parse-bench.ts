import { bench, describe } from 'vitest';
import { newParser } from '../src/core/parser/ParserHost.js';
import { assertParses, generatePSS } from './Sources.js';

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

  // Measure parsing, not error recovery. See Sources.ts.
  assertParses(src1k, '1K');
  assertParses(src5k, '5K');
  assertParses(src10k, '10K');

  bench('parse 1K lines', () => parseOnly(src1k));
  bench('parse 5K lines', () => parseOnly(src5k));
  bench('parse 10K lines', () => parseOnly(src10k));

  bench('parse + link 1K lines', () => parseAndLink(src1k));
  bench('parse + link 5K lines', () => parseAndLink(src5k));
});
