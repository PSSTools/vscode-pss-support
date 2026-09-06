import { describe, it, expect } from 'vitest';
import { StdlibLoader, resolveStdlibDir } from '../../../src/core/analysis/StdlibLoader';
import { MemFileSystem } from '../../../src/core/io/MemFileSystem';
import { SymbolTableBuilder } from '../../../src/core/analysis/SymbolTableBuilder';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';

describe('StdlibLoader', () => {
  it('loads bundled stdlib when no dir specified', () => {
    const loader = new StdlibLoader();
    const scopes = loader.load();
    expect(scopes.length).toBeGreaterThan(0);
  });

  it('bundled stdlib parses without errors', () => {
    const loader = new StdlibLoader();
    const scopes = loader.load();
    for (const scope of scopes) {
      expect(scope.fileid).toBeLessThan(0); // negative IDs for stdlib
    }
  });

  it('stdlib symbols are resolvable in symbol table', () => {
    const loader = new StdlibLoader();
    const stdlibScopes = loader.load();

    // Parse a user file
    const facade = new PSSParserFacade();
    const result = facade.parse('struct my_s { }');
    const builder = new PSSASTBuilder(0, result.tokens);
    const userScope = builder.build(result.tree);

    // Build symbol table with stdlib + user files
    const stb = new SymbolTableBuilder();
    const symResult = stb.build([...stdlibScopes, userScope]);

    expect(symResult.root.symtab.has('my_s')).toBe(true);
    // std_pkg should be registered
    expect(symResult.root.symtab.has('std_pkg')).toBe(true);
  });

  // These used to point at a checkout of zuspec-fe-pss that ivpm no longer
  // fetches. Because a missing directory silently falls back to BUNDLED_STDLIB,
  // the assertion passed without ever exercising the disk path. Driving the
  // loader through MemFileSystem tests what the name claims, and does not
  // depend on anything outside the repo.
  it('loads every .pss file from the stdlib dir when it exists', () => {
    const fs = new MemFileSystem({
      '/stdlib/std_pkg.pss': 'package std_pkg { function void print(string fmt); }',
      '/stdlib/addr_reg_pkg.pss': 'package addr_reg_pkg { struct addr_handle_s { } }',
      '/stdlib/notes.txt': 'ignored',
    });
    const scopes = new StdlibLoader('/stdlib', fs).load();

    expect(scopes.map(s => s.filename).sort()).toEqual(['addr_reg_pkg.pss', 'std_pkg.pss']);
  });

  it('prefers disk contents over the bundled fallback', () => {
    const fs = new MemFileSystem({
      '/stdlib/std_pkg.pss': 'package std_pkg { function void only_on_disk(); }',
    });
    const scopes = new StdlibLoader('/stdlib', fs).load();

    const stb = new SymbolTableBuilder();
    const root = stb.build(scopes).root;
    const idx = root.symtab.get('std_pkg')!;
    const pkg = root.children[idx] as unknown as { symtab: Map<string, number> };
    expect(pkg.symtab.has('only_on_disk')).toBe(true);
    // The bundled stub's symbols must not be present alongside the real ones.
    expect(pkg.symtab.has('urandom_range')).toBe(false);
  });

  it('falls back to bundled stdlib when the dir is absent', () => {
    const scopes = new StdlibLoader('/no/such/dir', new MemFileSystem()).load();
    expect(scopes).toHaveLength(1);
    expect(scopes[0].filename).toBe('std_pkg.pss');
  });

  it('assigns distinct negative file ids in a stable order', () => {
    const fs = new MemFileSystem({
      '/stdlib/b_pkg.pss': 'package b_pkg { }',
      '/stdlib/a_pkg.pss': 'package a_pkg { }',
    });
    const ids = new StdlibLoader('/stdlib', fs).load().map(s => s.fileid);
    expect(ids).toEqual([-1000, -1001]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('resolveStdlibDir', () => {
  it('finds a stdlib directory beside the server output', () => {
    const fs = new MemFileSystem({ '/srv/out/stdlib/std_pkg.pss': 'package std_pkg { }' });
    expect(resolveStdlibDir('/srv/out/core/analysis', fs)).toBe('/srv/out/stdlib');
  });

  it('returns undefined when no stdlib is packaged', () => {
    expect(resolveStdlibDir('/srv/out/core/analysis', new MemFileSystem())).toBeUndefined();
  });
});
