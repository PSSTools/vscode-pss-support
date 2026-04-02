import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { SymbolTableBuilder } from '../../../src/core/analysis/SymbolTableBuilder';
import { ReferenceResolver } from '../../../src/core/analysis/ReferenceResolver';
import { GlobalScope, RootSymbolScope } from '../../../src/core/ast/generated';

function buildAndResolve(sources: string[]): {
  root: RootSymbolScope;
  diagnostics: ReturnType<ReferenceResolver['resolve']>['diagnostics'];
  crossFileRefs: ReturnType<ReferenceResolver['resolve']>['crossFileRefs'];
} {
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

  const resolver = new ReferenceResolver();
  const resolveResult = resolver.resolve(root);

  return {
    root,
    diagnostics: resolveResult.diagnostics,
    crossFileRefs: resolveResult.crossFileRefs,
  };
}

describe('ReferenceResolver', () => {
  it('should resolve intra-file type reference', () => {
    const { diagnostics } = buildAndResolve([
      `struct my_data {
        rand bit[32] value;
      }
      component c {
        action my_action {
          rand my_data d;
        }
      }`,
    ]);

    expect(diagnostics.filter(d => d.code === 'undefined-type')).toHaveLength(0);
  });

  it('should detect undefined type', () => {
    const { diagnostics } = buildAndResolve([
      `component c {
        action my_action {
          rand undefined_type x;
        }
      }`,
    ]);

    const undefinedDiags = diagnostics.filter(d => d.code === 'undefined-type');
    expect(undefinedDiags.length).toBeGreaterThan(0);
  });

  it('should resolve base type (inheritance)', () => {
    const { diagnostics } = buildAndResolve([
      `component c {
        action base_action { }
        action child_action : base_action { }
      }`,
    ]);

    expect(diagnostics.filter(d => d.code === 'unresolved-base-type')).toHaveLength(0);
  });

  it('should detect unresolved base type', () => {
    const { diagnostics } = buildAndResolve([
      `component c {
        action child_action : nonexistent_base { }
      }`,
    ]);

    const baseDiags = diagnostics.filter(d => d.code === 'unresolved-base-type');
    expect(baseDiags.length).toBeGreaterThan(0);
  });

  it('should detect circular inheritance', () => {
    const { diagnostics } = buildAndResolve([
      `struct action_a : action_b { }
      struct action_b : action_a { }`,
    ]);

    const circDiags = diagnostics.filter(d => d.code === 'circular-inheritance');
    expect(circDiags.length).toBeGreaterThan(0);
  });

  it('should resolve cross-file type references', () => {
    const { diagnostics, crossFileRefs } = buildAndResolve([
      `struct shared_data {
        rand bit[32] value;
      }`,
      `component c {
        action consumer_action {
          rand shared_data d;
        }
      }`,
    ]);

    expect(diagnostics.filter(d => d.code === 'undefined-type')).toHaveLength(0);
  });

  it('should resolve types inside packages', () => {
    const { diagnostics } = buildAndResolve([
      `package my_pkg {
        struct my_data {
          rand bit[32] val;
        }
        component c {
          action my_action {
            rand my_data d;
          }
        }
      }`,
    ]);

    expect(diagnostics.filter(d => d.code === 'undefined-type')).toHaveLength(0);
  });

  it('should handle built-in types without error', () => {
    const { diagnostics } = buildAndResolve([
      `component c {
        action my_action {
          rand bit[32] addr;
          rand bool flag;
          string name;
        }
      }`,
    ]);

    expect(diagnostics.filter(d => d.code === 'undefined-type')).toHaveLength(0);
  });

  it('should resolve enum type reference in field', () => {
    const { diagnostics } = buildAndResolve([
      `enum dir_e { READ, WRITE }
      component c {
        action my_action {
          rand dir_e direction;
        }
      }`,
    ]);

    expect(diagnostics.filter(d => d.code === 'undefined-type')).toHaveLength(0);
  });

  it('should resolve struct inheritance', () => {
    const { diagnostics } = buildAndResolve([
      `struct base_s {
        rand bit[32] x;
      }
      struct child_s : base_s {
        rand bit[32] y;
      }`,
    ]);

    expect(diagnostics.filter(d => d.code === 'unresolved-base-type')).toHaveLength(0);
  });

  it('should handle empty source without error', () => {
    const { diagnostics } = buildAndResolve([``]);
    expect(diagnostics).toHaveLength(0);
  });

  it('should resolve multi-level inheritance', () => {
    const { diagnostics } = buildAndResolve([
      `struct a { }
      struct b : a { }
      struct c : b { }`,
    ]);

    expect(diagnostics.filter(d => d.code === 'unresolved-base-type')).toHaveLength(0);
    expect(diagnostics.filter(d => d.code === 'circular-inheritance')).toHaveLength(0);
  });
});
