import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Differential testing between this extension's analyzer and `pssparser`.
 *
 * The extension re-implements the PSS front end in TypeScript, so the two can
 * drift on any construct. Both are headless CLIs, which makes the comparison a
 * plain subprocess diff -- the mitigation for the "two front ends, one
 * language" risk.
 *
 * Skips when the pssparser binary is not built; a developer machine without it
 * should not fail the suite, but CI that builds pssparser gets the coverage.
 */

const ROOT = join(__dirname, '..');

/** Locations pssparser's CLI may have been built into. */
const CANDIDATES = [
  join(ROOT, 'packages/pssparser/build/src/pss-check'),
  join(ROOT, 'packages/pssparser/build/pss-check'),
  join(ROOT, 'packages/python/bin/pss-check'),
];

function findReferenceCli(): string | undefined {
  return CANDIDATES.find(existsSync);
}

const referenceCli = findReferenceCli();
const extensionCli = join(ROOT, 'server/out/cli/pss-check.js');

/** A diagnostic reduced to what both front ends should agree on. */
interface Marker {
  line: number;
  column: number;
  severity: string;
}

/** Parse GCC-style `file:line:col: severity: message` output. */
function parseMarkers(output: string): Marker[] {
  const markers: Marker[] = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^(.*?):(\d+):(\d+):\s*(error|warning|info|hint):/);
    if (match) {
      markers.push({ line: Number(match[2]), column: Number(match[3]), severity: match[4] });
    }
  }
  return markers;
}

function run(cli: string, file: string): string {
  try {
    if (cli.endsWith('.js')) {
      return execFileSync(process.execPath, [cli, file], { encoding: 'utf-8' });
    }
    return execFileSync(cli, [file], { encoding: 'utf-8' });
  } catch (e) {
    // Both CLIs exit non-zero when they report errors; the output is the point.
    const err = e as { stdout?: string };
    return err.stdout ?? '';
  }
}

const CORPUS: Record<string, string> = {
  'clean.pss': 'component top {\n    int a;\n}\n',
  'undefined-type.pss': 'component top {\n    nowhere_s x;\n}\n',
  'missing-semicolon.pss': 'component top {\n    int a\n}\n',
  'unclosed-brace.pss': 'component top {\n    int a;\n',
};

describe.skipIf(!referenceCli || !existsSync(extensionCli))(
  'differential vs pssparser',
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'pss-diff-'));

    for (const [name, source] of Object.entries(CORPUS)) {
      it(`agrees on ${name}`, () => {
        const file = join(dir, name);
        writeFileSync(file, source);

        const ours = parseMarkers(run(extensionCli, file));
        const theirs = parseMarkers(run(referenceCli!, file));

        // Compare positions and severities, not message text: the friendly
        // message port is separate work, and identical wording is not yet a
        // goal. Positions disagreeing means the two front ends genuinely
        // disagree about the code.
        expect(ours).toEqual(theirs);
      });
    }
  },
);

describe('differential harness', () => {
  it('reports whether the reference CLI is available', () => {
    // Not an assertion about the tools -- this records in the test output
    // whether the differential suite actually ran, so a permanently skipped
    // suite is visible rather than silently absent.
    if (!referenceCli) {
      console.info(
        `[differential] pssparser CLI not found; searched:\n  ${CANDIDATES.join('\n  ')}`,
      );
    }
    if (!existsSync(extensionCli)) {
      console.info(`[differential] extension CLI not built at ${extensionCli}; run 'tsc -b'`);
    }
    expect(true).toBe(true);
  });

  it('parses GCC-style diagnostic lines', () => {
    const markers = parseMarkers([
      'a.pss:3:5: error: Undefined type \'foo\'',
      'a.pss:10:1: warning: something',
      'not a diagnostic line',
    ].join('\n'));

    expect(markers).toEqual([
      { line: 3, column: 5, severity: 'error' },
      { line: 10, column: 1, severity: 'warning' },
    ]);
  });
});
