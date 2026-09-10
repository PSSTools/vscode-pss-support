import { describe, it, expect } from 'vitest';
import { SymbolTableBuilder } from '../../../src/core/analysis/SymbolTableBuilder.js';
import { ImportResolver } from '../../../src/core/analysis/ImportResolver.js';
import { newParser } from '../../../src/core/parser/ParserHost.js';
import { GlobalScope, RootSymbolScope, SymbolScope } from '../../../src/core/ast/generated/index.js';

function buildAndResolve(sources: string[]) {
  const parser = newParser();
  let scopes: GlobalScope[];
  try {
    // One call per source, so a deliberately-malformed fixture fails only
    // itself -- `parseSources` abandons the whole batch at the first error.
    for (let i = 0; i < sources.length; i++) {
      parser.parseSources([{ name: `file_${i}.pss`, content: sources[i] }]);
    }
    try {
      parser.link();
    } catch {
      // These fixtures exercise unresolved imports on purpose.
    }
    const names = parser.fileMap();
    scopes = parser.userUnits();
    for (const gs of scopes) {
      gs.filename = names.get(gs.fileid) ?? '';
    }
  } finally {
    parser.dispose();
  }

  const symBuilder = new SymbolTableBuilder();
  const { root } = symBuilder.build(scopes);

  const resolver = new ImportResolver();
  const resolveResult = resolver.resolve(root);

  return { root, diagnostics: resolveResult.diagnostics, resolver };
}

describe('ImportResolver', () => {
  it('should resolve wildcard import', () => {
    const { diagnostics } = buildAndResolve([
      `package my_pkg {
        struct my_struct { }
      }`,
      `package other_pkg {
        import my_pkg::*;
      }`,
    ]);

    expect(diagnostics).toHaveLength(0);
  });

  it('should report error for unresolved import', () => {
    const { diagnostics } = buildAndResolve([
      `package my_pkg {
        import nonexistent_pkg::*;
      }`,
    ]);

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].code).toBe('unresolved-import');
  });

  it('should resolve specific import', () => {
    const { diagnostics } = buildAndResolve([
      `package my_pkg {
        struct my_struct { }
      }`,
      `package other_pkg {
        import my_pkg::my_struct;
      }`,
    ]);

    expect(diagnostics).toHaveLength(0);
  });

  it('should handle multiple imports', () => {
    const { diagnostics } = buildAndResolve([
      `package pkg_a {
        struct struct_a { }
      }`,
      `package pkg_b {
        struct struct_b { }
      }`,
      `package pkg_c {
        import pkg_a::*;
        import pkg_b::*;
      }`,
    ]);

    expect(diagnostics).toHaveLength(0);
  });

  it('should handle source with no imports', () => {
    const { diagnostics } = buildAndResolve([
      `struct standalone_struct { }`,
    ]);

    expect(diagnostics).toHaveLength(0);
  });

  it('should support lookupSymbol', () => {
    const { root, resolver } = buildAndResolve([
      `package my_pkg { struct my_struct { } }`,
    ]);

    const found = resolver.lookupSymbol('my_struct', root, root);
    expect(found).not.toBeNull();
  });
});
