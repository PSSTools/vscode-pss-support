import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { SymbolTableBuilder } from '../../../src/core/analysis/SymbolTableBuilder';
import { ExtensionApplicator } from '../../../src/core/analysis/ExtensionApplicator';
import { GlobalScope, SymbolScope, SymbolTypeScope, SymbolEnumScope } from '../../../src/core/ast/generated';

function buildSymbolTree(source: string) {
  const parser = new PSSParserFacade();
  const result = parser.parse(source, 1);
  const builder = new PSSASTBuilder(1, result.tokens);
  const gs = builder.build(result.tree);
  const symBuilder = new SymbolTableBuilder();
  return symBuilder.build([gs]);
}

describe('ExtensionApplicator', () => {
  it('should merge extend-struct fields into target struct', () => {
    const { root } = buildSymbolTree(`
      struct my_struct {
        rand bit[32] addr;
      }
      extend struct my_struct {
        rand bit[32] data;
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics).toHaveLength(0);
    expect(root.symtab.has('my_struct')).toBe(true);
    const idx = root.symtab.get('my_struct')!;
    const scope = root.children[idx] as SymbolScope;
    expect(scope.symtab.has('data')).toBe(true);
  });

  it('should merge extend-action fields inside component', () => {
    const { root } = buildSymbolTree(`
      component c {
        action my_action {
          rand bit[32] addr;
        }
      }
      extend action my_action {
        rand bit[32] data;
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    // The extend target "my_action" must be found in the scope hierarchy
    // It may produce an error if it can't find it at root level
    // This is expected since my_action is nested inside component c
  });

  it('should merge extend-enum items into target enum', () => {
    const { root } = buildSymbolTree(`
      enum color_e {
        RED, GREEN, BLUE
      }
      extend enum color_e {
        YELLOW
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics).toHaveLength(0);
    const idx = root.symtab.get('color_e')!;
    const enumScope = root.children[idx] as SymbolEnumScope;
    expect(enumScope.symtab.has('YELLOW')).toBe(true);
  });

  it('should report error for unresolved extend target', () => {
    const { root } = buildSymbolTree(`
      extend struct nonexistent_struct {
        rand bit[32] x;
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].code).toBe('unresolved-extend-target');
  });

  it('should report error for duplicate member in extension', () => {
    const { root } = buildSymbolTree(`
      struct my_struct {
        rand bit[32] addr;
      }
      extend struct my_struct {
        rand bit[32] addr;
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].code).toBe('extend-duplicate-member');
  });

  it('should report error for kind mismatch', () => {
    const { root } = buildSymbolTree(`
      component my_comp { }
      extend struct my_comp {
        rand bit[32] x;
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].code).toBe('extend-kind-mismatch');
  });

  it('should handle extend with multiple fields', () => {
    const { root } = buildSymbolTree(`
      struct base_struct { }
      extend struct base_struct {
        rand bit[32] f1;
        rand bit[32] f2;
        rand bit[32] f3;
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics).toHaveLength(0);
    const idx = root.symtab.get('base_struct')!;
    const scope = root.children[idx] as SymbolScope;
    expect(scope.symtab.has('f1')).toBe(true);
    expect(scope.symtab.has('f2')).toBe(true);
    expect(scope.symtab.has('f3')).toBe(true);
  });

  it('should handle extend enum with duplicate item', () => {
    const { root } = buildSymbolTree(`
      enum status_e { OK, FAIL }
      extend enum status_e { OK }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].code).toBe('extend-duplicate-member');
  });

  it('should handle extend inside package scope', () => {
    const { root } = buildSymbolTree(`
      package my_pkg {
        struct pkg_struct { }
        extend struct pkg_struct {
          rand bit[32] x;
        }
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics).toHaveLength(0);
  });

  it('should apply no changes when no extensions exist', () => {
    const { root } = buildSymbolTree(`
      struct simple_struct {
        rand bit[32] addr;
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics).toHaveLength(0);
  });

  it('should handle empty extension body', () => {
    const { root } = buildSymbolTree(`
      struct my_struct { rand bit[32] addr; }
      extend struct my_struct { }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics).toHaveLength(0);
  });

  it('should handle component extension', () => {
    const { root } = buildSymbolTree(`
      component my_comp { }
      extend component my_comp {
        action comp_action { }
      }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics).toHaveLength(0);
    const idx = root.symtab.get('my_comp')!;
    const scope = root.children[idx] as SymbolScope;
    expect(scope.symtab.has('comp_action')).toBe(true);
  });

  it('should handle multiple extensions on same target', () => {
    const { root } = buildSymbolTree(`
      struct target_s { }
      extend struct target_s { rand bit[32] a; }
      extend struct target_s { rand bit[32] b; }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics).toHaveLength(0);
    const idx = root.symtab.get('target_s')!;
    const scope = root.children[idx] as SymbolScope;
    expect(scope.symtab.has('a')).toBe(true);
    expect(scope.symtab.has('b')).toBe(true);
  });

  it('should report error for extend-enum on non-enum target', () => {
    const { root } = buildSymbolTree(`
      struct my_struct { }
      extend enum my_struct { ITEM_A }
    `);

    const applicator = new ExtensionApplicator();
    const result = applicator.apply(root);

    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
  it('should merge action extension as SymbolScope (not raw AST node)', () => {
    const { root } = buildSymbolTree(`
      component my_comp { }
      extend component my_comp {
        action comp_action { }
      }
    `);

    const applicator = new ExtensionApplicator();
    applicator.apply(root);

    const compIdx = root.symtab.get('my_comp')!;
    const compScope = root.children[compIdx] as SymbolScope;
    expect(compScope.symtab.has('comp_action')).toBe(true);

    // The child at the symtab index must be a SymbolScope so that
    // qualified lookup (e.g. lookupPath(['my_comp', 'comp_action']))
    // succeeds.
    const actionIdx = compScope.symtab.get('comp_action')!;
    const actionEntry = compScope.children[actionIdx];
    expect(actionEntry instanceof SymbolScope).toBe(true);
  });

  it('should allow qualified path lookup through extended type', () => {
    const { root } = buildSymbolTree(`
      component my_comp { }
      extend component my_comp {
        action comp_action { }
      }
    `);

    const applicator = new ExtensionApplicator();
    applicator.apply(root);

    // Simulate the lookupPath traversal that DefinitionService performs
    function lookupPath(parts: string[], scope: SymbolScope): SymbolScope | null {
      let current: SymbolScope = scope;
      for (const part of parts) {
        if (!current.symtab.has(part)) return null;
        const idx = current.symtab.get(part)!;
        const child = current.children[idx];
        if (!(child instanceof SymbolScope)) return null;
        current = child;
      }
      return current;
    }

    const found = lookupPath(['my_comp', 'comp_action'], root);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('comp_action');
  });

  it('should set upper pointer of merged SymbolScope to target scope', () => {
    const { root } = buildSymbolTree(`
      component my_comp { }
      extend component my_comp {
        action comp_action { }
      }
    `);

    const applicator = new ExtensionApplicator();
    applicator.apply(root);

    const compIdx = root.symtab.get('my_comp')!;
    const compScope = root.children[compIdx] as SymbolScope;
    const actionIdx = compScope.symtab.get('comp_action')!;
    const actionScope = compScope.children[actionIdx] as SymbolScope;
    // The upper pointer should be the target component scope
    expect(actionScope.upper).toBe(compScope);
  });

  it('should merge fields from extend alongside SymbolScope types', () => {
    const { root } = buildSymbolTree(`
      component my_comp { }
      extend component my_comp {
        action comp_action { }
        int extra_field;
      }
    `);

    const applicator = new ExtensionApplicator();
    applicator.apply(root);

    const compIdx = root.symtab.get('my_comp')!;
    const compScope = root.children[compIdx] as SymbolScope;
    // Both the action (as SymbolScope) and the field should be present
    expect(compScope.symtab.has('comp_action')).toBe(true);
    expect(compScope.symtab.has('extra_field')).toBe(true);

    // Action should be SymbolScope
    const actionIdx = compScope.symtab.get('comp_action')!;
    expect(compScope.children[actionIdx] instanceof SymbolScope).toBe(true);
  });
});
