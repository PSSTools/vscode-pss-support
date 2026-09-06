import { describe, it, expect } from 'vitest';
import { MemFileSystem } from '../../../src/core/io/MemFileSystem';
import { FileSystemDiscovery } from '../../../src/core/io/FileSystemDiscovery';
import { WorkspaceLoader } from '../../../src/core/index/WorkspaceLoader';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { pathToUri } from '../../../src/core/io/UriUtils';

function projectFs(): MemFileSystem {
  return new MemFileSystem({
    '/ws/top.pss': 'component top { }',
    '/ws/pkg/a.pss': 'package a { struct s { } }',
    '/ws/pkg/nested/b.pss': 'package b { }',
    '/ws/notes.md': '# not pss',
    '/ws/node_modules/dep/x.pss': 'component should_not_be_indexed { }',
    '/ws/.hidden/y.pss': 'component also_skipped { }',
  });
}

describe('FileSystemDiscovery', () => {
  it('finds .pss files recursively and returns sorted URIs', async () => {
    const uris = await new FileSystemDiscovery(projectFs()).discoverFiles('file:///ws', '.pss');
    expect(uris).toEqual([
      pathToUri('/ws/pkg/a.pss'),
      pathToUri('/ws/pkg/nested/b.pss'),
      pathToUri('/ws/top.pss'),
    ]);
  });

  it('skips node_modules and dot-directories', async () => {
    const uris = await new FileSystemDiscovery(projectFs()).discoverFiles('file:///ws', '.pss');
    expect(uris.some(u => u.includes('node_modules'))).toBe(false);
    expect(uris.some(u => u.includes('.hidden'))).toBe(false);
  });

  it('ignores files that do not match the suffix', async () => {
    const uris = await new FileSystemDiscovery(projectFs()).discoverFiles('file:///ws', '.pss');
    expect(uris.some(u => u.endsWith('.md'))).toBe(false);
  });

  it('returns empty for a root that does not exist', async () => {
    const uris = await new FileSystemDiscovery(projectFs()).discoverFiles('file:///nope', '.pss');
    expect(uris).toEqual([]);
  });
});

describe('WorkspaceLoader', () => {
  it('populates an index from a filesystem root', async () => {
    const fs = projectFs();
    const index = await WorkspaceLoader.load(['file:///ws'], { fs });

    expect(index.getFileUris().sort()).toEqual([
      pathToUri('/ws/pkg/a.pss'),
      pathToUri('/ws/pkg/nested/b.pss'),
      pathToUri('/ws/top.pss'),
    ]);
    expect(index.getAST(pathToUri('/ws/top.pss'))).toBeDefined();
  });

  it('keeps the source text alongside the AST', async () => {
    const fs = projectFs();
    const index = await WorkspaceLoader.load(['file:///ws'], { fs });
    expect(index.getText(pathToUri('/ws/top.pss'))).toBe('component top { }');
  });

  it('does not clobber a file already in the index', async () => {
    const fs = projectFs();
    const index = new WorkspaceIndex(undefined, fs);
    const uri = pathToUri('/ws/top.pss');

    // Simulate an open, edited buffer that differs from disk.
    index.addFile(uri, 'component edited_in_buffer { }');

    const added = await new WorkspaceLoader({ fs }).loadInto(index, ['file:///ws']);

    expect(added).not.toContain(uri);
    expect(index.getText(uri)).toBe('component edited_in_buffer { }');
  });

  it('resolves symbols across files discovered from disk', async () => {
    const fs = new MemFileSystem({
      '/ws/pkg.pss': 'package p { struct s { } }',
      '/ws/top.pss': 'component top { p::s x; }',
    });
    const index = await WorkspaceLoader.load(['file:///ws'], { fs });

    const diags = index.getDiagnostics(pathToUri('/ws/top.pss'));
    expect(diags.filter(d => d.code === 'undefined-type')).toHaveLength(0);
  });

  it('loads multiple roots into one index', async () => {
    const fs = new MemFileSystem({
      '/a/one.pss': 'component one { }',
      '/b/two.pss': 'component two { }',
    });
    const index = await WorkspaceLoader.load(['file:///a', 'file:///b'], { fs });
    expect(index.getFileUris()).toHaveLength(2);
  });
});
