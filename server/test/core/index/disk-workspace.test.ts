import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { WorkspaceLoader } from '../../../src/core/index/WorkspaceLoader.js';
import { pathToUri } from '../../../src/core/io/UriUtils.js';
import { DiagnosticSeverity } from '../../../src/core/types/Diagnostic.js';
import { makeIndex } from '../../helpers/Indexes.js';

/**
 * The loader and index against a real directory on disk, through the default
 * `NodeFileSystem`. `WorkspaceLoader.test.ts` covers the same pipeline over a
 * `MemFileSystem`; this is the path the server takes at startup.
 *
 * These assertions were carried over from the tests of the removed `pss-check`
 * CLI, which ran the same pipeline.
 */

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pss-disk-'));
  mkdirSync(join(dir, 'pkg'), { recursive: true });

  writeFileSync(join(dir, 'pkg', 'types.pss'),
    'package p {\n    struct data_s { rand bit[32] addr; }\n}\n');
  writeFileSync(join(dir, 'top.pss'),
    'component top {\n    p::data_s cfg;\n    nowhere_s bad;\n}\n');
  writeFileSync(join(dir, 'notes.md'), 'not a pss file\n');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function load(root: string) {
  const index = makeIndex();
  const uris = await new WorkspaceLoader().loadInto(index, [pathToUri(root)]);
  return { index, uris };
}

describe('workspace on disk', () => {
  it('discovers .pss files recursively and ignores the rest', async () => {
    const { uris } = await load(dir);
    expect(uris.slice().sort()).toEqual([
      pathToUri(join(dir, 'pkg', 'types.pss')),
      pathToUri(join(dir, 'top.pss')),
    ]);
  });

  it('resolves types across files, reporting only the genuine error', async () => {
    const { index } = await load(dir);

    expect(index.getDiagnostics(pathToUri(join(dir, 'pkg', 'types.pss')))).toEqual([]);

    const diags = index.getDiagnostics(pathToUri(join(dir, 'top.pss')));
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(DiagnosticSeverity.Error);
    expect(diags[0].message).toBe("unknown type 'nowhere_s'");
    expect(diags[0].range.start.line).toBe(2);
    // Recorded gap: the column should be 4 (0-based), where `nowhere_s` starts.
    //
    // `Location.linepos` is 0-based when it comes from a token and 1-based
    // when it comes from an AST node (`AstBuilderInt.cpp` adds one;
    // `syntaxError` does not). The marker emitter adds one unconditionally,
    // which is right for syntax markers and one too far right for every
    // marker the linker raises. Pinned here so that fixing the core shows up
    // as this test failing rather than as a silent shift.
    expect(diags[0].range.start.character).toBe(5);
  });

  it('reports a clean project with no diagnostics', async () => {
    const clean = mkdtempSync(join(tmpdir(), 'pss-clean-'));
    try {
      writeFileSync(join(clean, 'a.pss'), 'component c { int a; }\n');
      const { index, uris } = await load(clean);
      expect(uris).toHaveLength(1);
      expect(index.getDiagnostics(uris[0])).toEqual([]);
    } finally {
      rmSync(clean, { recursive: true, force: true });
    }
  });

  it('finds nothing in an empty directory', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'pss-empty-'));
    try {
      const { uris } = await load(empty);
      expect(uris).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
