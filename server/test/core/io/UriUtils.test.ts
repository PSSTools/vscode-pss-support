import { describe, it, expect } from 'vitest';
import { pathToUri, uriToPath, joinPath, normalizePath } from '../../../src/core/io/UriUtils.js';

describe('UriUtils', () => {
  it('round-trips POSIX paths', () => {
    const p = '/home/me/proj/top.pss';
    expect(uriToPath(pathToUri(p))).toBe(p);
  });

  it('produces file:// URIs', () => {
    expect(pathToUri('/ws/a.pss')).toBe('file:///ws/a.pss');
  });

  it('percent-encodes spaces and round-trips them', () => {
    const uri = pathToUri('/ws/my project/a.pss');
    expect(uri).toBe('file:///ws/my%20project/a.pss');
    expect(uriToPath(uri)).toBe('/ws/my project/a.pss');
  });

  it('round-trips Windows drive paths', () => {
    expect(uriToPath(pathToUri('C:\\ws\\a.pss'))).toBe('C:/ws/a.pss');
  });

  it('passes non-file URIs through unchanged', () => {
    expect(uriToPath('untitled:Untitled-1')).toBe('untitled:Untitled-1');
  });

  it('joins paths without doubling separators', () => {
    expect(joinPath('/ws', 'pkg', 'a.pss')).toBe('/ws/pkg/a.pss');
    expect(joinPath('/ws/', '/pkg/', 'a.pss')).toBe('/ws/pkg/a.pss');
  });

  it('collapses . and .. when joining', () => {
    expect(joinPath('/srv/out/core/analysis', '../../stdlib')).toBe('/srv/out/stdlib');
    expect(joinPath('/ws/pkg', './a.pss')).toBe('/ws/pkg/a.pss');
  });

  it('normalizes absolute paths', () => {
    expect(normalizePath('/a/b/../c')).toBe('/a/c');
    expect(normalizePath('/a//b/./c')).toBe('/a/b/c');
    // '..' past the root has nowhere to go and is dropped.
    expect(normalizePath('/../a')).toBe('/a');
  });

  it('keeps leading .. on relative paths', () => {
    expect(normalizePath('../a/b')).toBe('../a/b');
    expect(normalizePath('../../a')).toBe('../../a');
    expect(normalizePath('a/../../b')).toBe('../b');
  });
});
