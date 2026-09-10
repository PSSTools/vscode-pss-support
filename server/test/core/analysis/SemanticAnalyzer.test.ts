import { describe, it, expect } from 'vitest';
import { parseSources } from '../../helpers/ParseHelper.js';
import { SemanticAnalyzer } from '../../../src/core/analysis/SemanticAnalyzer.js';
import { GlobalScope } from '../../../src/core/ast/generated/index.js';

function parseFiles(sources: string[]): GlobalScope[] {
  const scopes = parseSources(sources).scopes;
  return scopes;
}

describe('SemanticAnalyzer', () => {
  it('should run all passes on a clean file', () => {
    const scopes = parseFiles([
      `component my_comp {
        action my_action {
          rand bit[32] addr;
        }
      }`,
    ]);

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(scopes);

    expect(result.root).toBeDefined();
    expect(result.root.symtab.has('my_comp')).toBe(true);
  });

  it('should detect duplicate symbols', () => {
    const scopes = parseFiles([
      `struct dup_s { }
      struct dup_s { }`,
    ]);

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(scopes);

    const allDiags = [...result.diagnostics.values()].flat();
    const dupDiags = allDiags.filter(d => d.code === 'duplicate-symbol');
    expect(dupDiags.length).toBeGreaterThan(0);
  });

  it('should detect undefined type references', () => {
    const scopes = parseFiles([
      `component c {
        action my_action {
          rand nonexistent_type x;
        }
      }`,
    ]);

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(scopes);

    const allDiags = [...result.diagnostics.values()].flat();
    const typeDiags = allDiags.filter(d => d.code === 'undefined-type');
    expect(typeDiags.length).toBeGreaterThan(0);
  });

  it('should handle multi-file analysis', () => {
    const scopes = parseFiles([
      `struct data_s { rand bit[32] val; }`,
      `component c { action use_action { rand data_s d; } }`,
    ]);

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(scopes);

    expect(result.root).toBeDefined();
  });

  it('should handle extensions end-to-end', () => {
    const scopes = parseFiles([
      `struct base_s { }
      extend struct base_s {
        rand bit[32] extended_field;
      }`,
    ]);

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(scopes);

    const idx = result.root.symtab.get('base_s');
    expect(idx).toBeDefined();
  });

  it('should return cross-file references', () => {
    const scopes = parseFiles([
      `struct shared_s { rand bit[32] x; }`,
      `component c { action user_a { rand shared_s s; } }`,
    ]);

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(scopes);

    expect(result.crossFileRefs).toBeDefined();
  });

  it('should handle empty input', () => {
    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze([]);

    expect(result.root).toBeDefined();
  });

  it('should analyze packages correctly', () => {
    const scopes = parseFiles([
      `package my_pkg {
        struct pkg_data { rand bit[32] val; }
        component c {
          action pkg_action { }
        }
      }`,
    ]);

    const analyzer = new SemanticAnalyzer();
    const result = analyzer.analyze(scopes);

    expect(result.root.symtab.has('my_pkg')).toBe(true);
  });
});
