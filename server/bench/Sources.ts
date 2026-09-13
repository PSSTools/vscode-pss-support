/**
 * Synthetic PSS of a requested size, for the benchmarks.
 *
 * Shared because the two benchmarks had a copy each and both copies were
 * wrong in the same way: they declared actions directly inside a `package`,
 * which is not legal PSS. `parseSources` threw on every iteration, vitest
 * recorded zero samples, and the run still printed a tick next to the file --
 * the parse benchmark had been reporting `0.0000 hz` and nobody had a reason
 * to look. `assertParses` below is the guard against a repeat: a generator
 * that stops producing valid source now fails the run instead of quietly
 * measuring an exception.
 */
import { newParser } from '../src/core/parser/ParserHost.js';

/**
 * Roughly `lines` lines of PSS: one component holding actions with fields,
 * a constraint and an empty activity apiece.
 */
export function generatePSS(lines: number, suffix = ''): string {
  const parts: string[] = [`component bench_c${suffix} {`];
  let lineCount = 1;
  let actionIdx = 0;

  while (lineCount < lines) {
    parts.push(`  action action_${actionIdx++} {`);
    lineCount++;

    for (let f = 0; f < 5 && lineCount < lines; f++) {
      parts.push(`    rand bit[32] field_${f};`);
      lineCount++;
    }

    if (lineCount < lines) {
      parts.push(`    constraint c {`);
      parts.push(`      field_0 > 0;`);
      parts.push(`      field_1 < 100;`);
      parts.push(`    }`);
      lineCount += 4;
    }

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
 * Throw unless `src` parses and links cleanly.
 *
 * Call once at module scope, not inside a `bench` body -- a benchmark that
 * validates its own input on every iteration is measuring the validation too.
 */
export function assertParses(src: string, label: string): void {
  const parser = newParser();
  try {
    parser.parseSources([{ name: 'bench.pss', content: src }]);
    parser.link();
    const markers = parser.markers.filter((m) => m.severity === 'error');
    if (markers.length > 0) {
      throw new Error(
        `benchmark source ${label} does not link cleanly: ${markers[0].message}`,
      );
    }
  } finally {
    parser.dispose();
  }
}
