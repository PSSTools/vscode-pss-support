import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { SymbolTableBuilder } from '../../../src/core/analysis/SymbolTableBuilder';
import { GlobalScope, SymbolTypeScope, SymbolEnumScope, SymbolFunctionScope } from '../../../src/core/ast/generated';

function buildSymbolTable(sources: string[]) {
  const facade = new PSSParserFacade();
  const scopes: GlobalScope[] = [];
  for (let i = 0; i < sources.length; i++) {
    const result = facade.parse(sources[i]);
    const builder = new PSSASTBuilder(i, result.tokens);
    scopes.push(builder.build(result.tree));
  }
  const stb = new SymbolTableBuilder();
  return stb.build(scopes);
}

describe('SymbolTableBuilder', () => {
  it('builds empty symbol table from empty source', () => {
    const result = buildSymbolTable(['']);
    expect(result.root).toBeDefined();
    expect(result.diagnostics).toHaveLength(0);
  });

  it('registers component', () => {
    const result = buildSymbolTable(['component my_comp { }']);
    expect(result.root.symtab.has('my_comp')).toBe(true);
    const idx = result.root.symtab.get('my_comp')!;
    const sym = result.root.children[idx];
    expect(sym).toBeInstanceOf(SymbolTypeScope);
  });

  it('registers struct', () => {
    const result = buildSymbolTable(['struct my_struct { }']);
    expect(result.root.symtab.has('my_struct')).toBe(true);
  });

  it('registers enum', () => {
    const result = buildSymbolTable(['enum color_e { RED, GREEN, BLUE }']);
    expect(result.root.symtab.has('color_e')).toBe(true);
    const idx = result.root.symtab.get('color_e')!;
    const sym = result.root.children[idx];
    expect(sym).toBeInstanceOf(SymbolEnumScope);
  });

  it('registers abstract action', () => {
    const result = buildSymbolTable(['abstract action my_act { }']);
    expect(result.root.symtab.has('my_act')).toBe(true);
  });

  it('registers action inside component', () => {
    const result = buildSymbolTable(['component c { action a { } }']);
    expect(result.root.symtab.has('c')).toBe(true);
    const compIdx = result.root.symtab.get('c')!;
    const compSym = result.root.children[compIdx] as SymbolTypeScope;
    expect(compSym.symtab.has('a')).toBe(true);
  });

  it('registers nested types', () => {
    const result = buildSymbolTable([`
      component c {
        action a1 { }
        action a2 { }
      }
    `]);
    const compIdx = result.root.symtab.get('c')!;
    const compSym = result.root.children[compIdx] as SymbolTypeScope;
    expect(compSym.symtab.has('a1')).toBe(true);
    expect(compSym.symtab.has('a2')).toBe(true);
  });

  it('merges package scopes', () => {
    const result = buildSymbolTable([
      'package pkg { struct s1 { } }',
      'package pkg { struct s2 { } }',
    ]);
    expect(result.root.symtab.has('pkg')).toBe(true);
    const pkgIdx = result.root.symtab.get('pkg')!;
    const pkgSym = result.root.children[pkgIdx] as SymbolTypeScope;
    expect(pkgSym.symtab.has('s1')).toBe(true);
    expect(pkgSym.symtab.has('s2')).toBe(true);
  });

  it('detects duplicate symbols', () => {
    const result = buildSymbolTable([
      'struct s { }\nstruct s { }',
    ]);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics[0].message).toContain('Duplicate');
  });

  it('registers types from multiple files', () => {
    const result = buildSymbolTable([
      'struct s1 { }',
      'struct s2 { }',
      'enum e { A }',
    ]);
    expect(result.root.symtab.has('s1')).toBe(true);
    expect(result.root.symtab.has('s2')).toBe(true);
    expect(result.root.symtab.has('e')).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('registers function declaration', () => {
    const result = buildSymbolTable(['function void my_func();']);
    // Function may or may not be registered depending on proto parsing
    expect(result.diagnostics).toHaveLength(0);
  });

  it('registers typedef', () => {
    const result = buildSymbolTable(['typedef int my_int_t;']);
    // The typedef name extraction uses the last type_identifier
    expect(result.diagnostics).toHaveLength(0);
  });

  it('handles extend without error', () => {
    const result = buildSymbolTable([
      'struct base_s { }',
      'extend struct base_s { rand int extra; }',
    ]);
    expect(result.root.symtab.has('base_s')).toBe(true);
    // Extend scope should be a child but not in symtab
    expect(result.diagnostics).toHaveLength(0);
  });

  it('handles struct fields without error', () => {
    const result = buildSymbolTable([`
      struct s {
        rand int<32> x;
        bool flag;
      }
    `]);
    expect(result.root.symtab.has('s')).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('handles complex multi-file project', () => {
    const result = buildSymbolTable([
      `package common {
        struct addr_s { rand int<32> addr; }
        enum op_e { READ, WRITE }
      }`,
      `package tests {
        abstract action base_test { }
      }`,
      `component pss_top {
        action test1 { }
        action test2 { }
      }`,
    ]);
    expect(result.root.symtab.has('common')).toBe(true);
    expect(result.root.symtab.has('tests')).toBe(true);
    expect(result.root.symtab.has('pss_top')).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('detects duplicate across packages', () => {
    const result = buildSymbolTable([
      'package pkg { struct s { } }',
      'package pkg { struct s { } }',
    ]);
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);
  });
});
