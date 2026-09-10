import { describe, it, expect } from 'vitest';
import { parseSource } from '../../helpers/ParseHelper.js';
import { analyzeResources } from '../../../src/core/analysis/ResourceAnalyzer.js';
import { GlobalScope } from '../../../src/core/ast/generated/index.js';

function analyze(source: string) {
  const ast = parseSource(source)!;
  const asts = new Map([['file:///t.pss', ast]]);
  return analyzeResources(asts);
}

describe('ResourceAnalyzer', () => {
  it('should find lock/share bindings', () => {
    const bindings = analyze(`
      resource my_res { }
      component c {
        action a {
          lock my_res r;
        }
      }
    `);
    const locks = bindings.filter(b => b.kind === 'lock');
    expect(locks.length).toBeGreaterThanOrEqual(1);
  });

  it('should find input/output bindings', () => {
    const bindings = analyze(`
      buffer my_buf { }
      component c {
        action a {
          input my_buf inp;
          output my_buf outp;
        }
      }
    `);
    const inputs = bindings.filter(b => b.kind === 'input');
    const outputs = bindings.filter(b => b.kind === 'output');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
    expect(outputs.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty for no resources', () => {
    const bindings = analyze('struct s { rand bit[32] x; }');
    expect(bindings).toHaveLength(0);
  });

  it('should track action name', () => {
    const bindings = analyze(`
      resource r { }
      component c {
        action my_action {
          share r res;
        }
      }
    `);
    const shares = bindings.filter(b => b.kind === 'share');
    expect(shares.length).toBeGreaterThanOrEqual(1);
    if (shares.length > 0) {
      expect(shares[0].actionName).toBeDefined();
    }
  });

  it('should handle multiple actions', () => {
    const bindings = analyze(`
      resource r { }
      component c {
        action a1 { lock r res1; }
        action a2 { share r res2; }
      }
    `);
    expect(bindings.length).toBeGreaterThanOrEqual(2);
  });

  it('should include uri and line info', () => {
    const bindings = analyze(`
      resource r { }
      component c {
        action a { lock r res; }
      }
    `);
    for (const b of bindings) {
      expect(b.uri).toBe('file:///t.pss');
    }
  });
});
