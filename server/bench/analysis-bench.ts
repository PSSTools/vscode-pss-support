/**
 * The cost of the whole-workspace parse and link.
 *
 * This used to time `SemanticAnalyzer.analyze`, which is gone: the parser's
 * `link()` builds the symbol table now. What is left is worth keeping and is
 * the number the design rests on -- `WorkspaceIndex` re-parses and re-links
 * every file on every edit rather than maintaining incremental state, and that
 * is only defensible while a whole workspace stays in the low hundreds of
 * milliseconds. If this benchmark starts climbing, that decision needs
 * revisiting, not the benchmark.
 */
import { afterAll, bench, describe } from 'vitest';

import { WorkspaceIndex } from '../src/core/index/WorkspaceIndex.js';
import { assertParses, generatePSS } from './Sources.js';

const SOURCES: Array<[string, string]> = Array.from({ length: 10 }, (_, i) =>
  [`file:///file_${i}.pss`, generatePSS(1000, `_${i}`)] as [string, string],
);

// Measure linking, not error recovery: WorkspaceIndex swallows parse failures
// per file, so bad source here would benchmark ten files failing quietly.
for (const [uri, text] of SOURCES) {
  assertParses(text, uri);
}

/** Populate an index without parsing: `addFile` only marks the parse stale. */
function loadedIndex(): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, text] of SOURCES) {
    index.addFile(uri, text);
  }
  return index;
}

describe('Workspace benchmarks', () => {
  bench('parse and link - 10 files x 1K lines', () => {
    const index = loadedIndex();
    try {
      // Reading diagnostics is what forces the parse; nothing before it does.
      index.getAllDiagnostics();
    } finally {
      index.dispose();
    }
  });
});

describe('Workspace query benchmarks', () => {
  // Parsed once, outside the bench body. Building the index inside it made
  // this time identical to the benchmark above -- the parse swamped the query
  // by three orders of magnitude, and the number meant nothing.
  const parsed = loadedIndex();
  parsed.getAllDiagnostics();

  afterAll(() => {
    parsed.dispose();
  });

  bench('symbol lookup on an already-parsed workspace', () => {
    parsed.findSymbolAtPosition(SOURCES[0][0], { line: 2, character: 10 });
  });
});
