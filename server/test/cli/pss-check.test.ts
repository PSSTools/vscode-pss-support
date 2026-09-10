import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { check } from '../../src/cli/pss-check.js';

/**
 * The CLI is the headless surface: it runs the same WorkspaceIndex pipeline the
 * language server does, so what it prints is by construction what the editor
 * would show. `check()` is separated from `main()` precisely so this can be
 * asserted without spawning a process or capturing stdout.
 */

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pss-cli-'));
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

describe('pss-check', () => {
  it('discovers .pss files recursively and ignores the rest', async () => {
    const result = await check(dir, dir);
    expect(result.fileCount).toBe(2);
  });

  it('resolves types across files, reporting only the genuine error', async () => {
    const result = await check(dir, dir);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toBe("top.pss:3:5: error: Undefined type 'nowhere_s'");
    expect(result.hasErrors).toBe(true);
  });

  it('reports paths relative to the given working directory', async () => {
    const result = await check(dir, dir);
    for (const line of result.lines) {
      expect(line.startsWith('/'), `'${line}' should be relative`).toBe(false);
    }
  });

  it('checks a single file when given one', async () => {
    const result = await check(join(dir, 'pkg', 'types.pss'), dir);
    expect(result.fileCount).toBe(1);
    expect(result.hasErrors).toBe(false);
  });

  it('reports a clean project with no output and no error flag', async () => {
    const clean = mkdtempSync(join(tmpdir(), 'pss-clean-'));
    writeFileSync(join(clean, 'a.pss'), 'component c { int a; }\n');

    const result = await check(clean, clean);
    expect(result.lines).toEqual([]);
    expect(result.hasErrors).toBe(false);

    rmSync(clean, { recursive: true, force: true });
  });

  it('throws a useful error for a path that does not exist', async () => {
    await expect(check(join(dir, 'no-such-file.pss'), dir)).rejects.toThrow(/cannot access/);
  });

  it('reports zero files for an empty directory', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'pss-empty-'));
    const result = await check(empty, empty);
    expect(result.fileCount).toBe(0);
    rmSync(empty, { recursive: true, force: true });
  });
});
