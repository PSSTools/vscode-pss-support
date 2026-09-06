import { describe, it, expect } from 'vitest';
import { MemFileSystem } from '../../../src/core/io/MemFileSystem';

describe('MemFileSystem', () => {
  const fs = () => new MemFileSystem({
    '/ws/top.pss': 'component top { }',
    '/ws/pkg/a.pss': 'package a { }',
    '/ws/pkg/b.pss': 'package b { }',
    '/ws/pkg/deep/c.pss': 'package c { }',
    '/ws/README.md': 'not pss',
  });

  it('reads files it was constructed with', () => {
    expect(fs().readFile('/ws/top.pss')).toBe('component top { }');
  });

  it('returns undefined for a missing file', () => {
    expect(fs().readFile('/ws/nope.pss')).toBeUndefined();
  });

  it('lists immediate children only, files and directories alike', () => {
    expect(fs().readDir('/ws').sort()).toEqual(['README.md', 'pkg', 'top.pss']);
    expect(fs().readDir('/ws/pkg').sort()).toEqual(['a.pss', 'b.pss', 'deep']);
  });

  it('treats directories as existing even though only files were added', () => {
    const f = fs();
    expect(f.exists('/ws/pkg')).toBe(true);
    expect(f.isDirectory('/ws/pkg')).toBe(true);
    expect(f.isDirectory('/ws/top.pss')).toBe(false);
    expect(f.exists('/ws/top.pss')).toBe(true);
  });

  it('does not treat a path prefix as a directory', () => {
    // '/ws/p' is a prefix of '/ws/pkg/a.pss' but is not a directory.
    expect(fs().isDirectory('/ws/p')).toBe(false);
  });

  it('normalizes backslashes and trailing separators', () => {
    const f = fs();
    expect(f.readFile('\\ws\\top.pss')).toBe('component top { }');
    expect(f.isDirectory('/ws/pkg/')).toBe(true);
  });

  it('supports add and remove', () => {
    const f = fs();
    f.addFile('/ws/new.pss', 'struct s { }');
    expect(f.readFile('/ws/new.pss')).toBe('struct s { }');
    f.removeFile('/ws/new.pss');
    expect(f.exists('/ws/new.pss')).toBe(false);
  });

  it('returns empty for readDir of a non-directory', () => {
    expect(fs().readDir('/nowhere')).toEqual([]);
  });
});
