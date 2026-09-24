import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { pathToUri } from '../../src/core/io/UriUtils.js';
import { DiagnosticSeverity } from '../../src/core/types/Diagnostic.js';
import { makeIndex } from '../helpers/Indexes.js';

/**
 * Differential testing between this server's analyzer and `pssparser`.
 *
 * The server layers its own analysis over the parser, so the two can drift
 * on any construct. The reference side is the `pssparser` command-line
 * checker from the pssparser Python package; this side is computed in-process through `WorkspaceIndex`, the same pipeline the
 * language server runs, and rendered as the positions that CLI would print.
 *
 * Skips when the pssparser command is not installed; a developer machine
 * without it should not fail the suite. `ivpm update` installs it into
 * `packages/python`.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * Where the reference checker may be installed. Until 2026-09 this listed
 * `pss-check` paths, which pssparser has never provided, so the suite always
 * skipped.
 */
const CANDIDATES = [
  join(ROOT, 'packages/python/bin/pssparser'),
];

function findReferenceCli(): string | undefined {
  return CANDIDATES.find(existsSync);
}

const referenceCli = findReferenceCli();

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

function runReference(file: string): string {
  // pssparser writes diagnostics to stderr and exits non-zero when it reports
  // errors; the output is the point, whichever stream it is on.
  const result = spawnSync(referenceCli!, ['--no-color', file], { encoding: 'utf-8' });
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

const SEVERITY: Record<DiagnosticSeverity, string> = {
  [DiagnosticSeverity.Error]: 'error',
  [DiagnosticSeverity.Warning]: 'warning',
  [DiagnosticSeverity.Information]: 'info',
  [DiagnosticSeverity.Hint]: 'hint',
};

/** The server's diagnostics for one file, as 1-based markers like the CLI's. */
function serverMarkers(file: string, source: string): Marker[] {
  const index = makeIndex();
  const uri = pathToUri(file);
  index.addFile(uri, source);
  return index.getDiagnostics(uri).map(d => ({
    line: d.range.start.line + 1,
    column: d.range.start.character + 1,
    severity: SEVERITY[d.severity],
  }));
}

const CORPUS: Record<string, string> = {
  'clean.pss': 'component top {\n    int a;\n}\n',
  'undefined-type.pss': 'component top {\n    nowhere_s x;\n}\n',
  'missing-semicolon.pss': 'component top {\n    int a\n}\n',
  'unclosed-brace.pss': 'component top {\n    int a;\n',
};

describe.skipIf(!referenceCli)(
  'differential vs pssparser',
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'pss-diff-'));

    for (const [name, source] of Object.entries(CORPUS)) {
      it(`agrees on ${name}`, () => {
        const file = join(dir, name);
        writeFileSync(file, source);

        const ours = serverMarkers(file, source);
        const theirs = parseMarkers(runReference(file));

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
        `[differential] pssparser command not found; searched:\n  ${CANDIDATES.join('\n  ')}`,
      );
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
