import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { SymbolTableBuilder } from '../../../src/core/analysis/SymbolTableBuilder';
import { ImportResolver } from '../../../src/core/analysis/ImportResolver';
import { GlobalScope, RootSymbolScope, SymbolScope } from '../../../src/core/ast/generated';

function buildAndResolve(sources: string[]) {
  const parser = new PSSParserFacade();
  const scopes: GlobalScope[] = [];
  for (let i = 0; i < sources.length; i++) {
    const result = parser.parse(sources[i], i + 1);
    const builder = new PSSASTBuilder(i + 1, result.tokens);
    const gs = builder.build(result.tree);
    gs.filename = `file_${i}.pss`;
    scopes.push(gs);
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
