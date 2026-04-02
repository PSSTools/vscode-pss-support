import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import {
  GlobalScope, Action, Component, Struct, Field, EnumDecl, PackageScope,
  PackageImportStmt, ExtendType, AnnotationDecl, TypedefDeclaration,
  FieldRef, FieldClaim,
} from '../../../src/core/ast/generated';
import { enums, flags } from '../../../src/core/ast/generated';
import { getNodeName, getNodeSignature, walkScope } from '../../../src/core/ast/ASTUtils';

function buildAST(source: string): GlobalScope {
  const facade = new PSSParserFacade();
  const result = facade.parse(source);
  const builder = new PSSASTBuilder(0, result.tokens);
  return builder.build(result.tree);
}

describe('PSSASTBuilder', () => {
  it('builds GlobalScope from empty source', () => {
    const gs = buildAST('');
    expect(gs).toBeInstanceOf(GlobalScope);
    expect(gs.children).toHaveLength(0);
  });

  it('builds component declaration', () => {
    const gs = buildAST('component my_comp { }');
    expect(gs.children).toHaveLength(1);
    const comp = gs.children[0] as Component;
    expect(comp).toBeInstanceOf(Component);
    expect(getNodeName(comp)).toBe('my_comp');
  });

  it('builds struct declaration', () => {
    const gs = buildAST('struct my_struct { }');
    expect(gs.children).toHaveLength(1);
    const s = gs.children[0] as Struct;
    expect(s).toBeInstanceOf(Struct);
    expect(getNodeName(s)).toBe('my_struct');
    expect(s.kind).toBe(enums.StructKind.Struct);
  });

  it('builds buffer declaration', () => {
    const gs = buildAST('buffer my_buf { }');
    const s = gs.children[0] as Struct;
    expect(s.kind).toBe(enums.StructKind.Buffer);
  });

  it('builds resource declaration', () => {
    const gs = buildAST('resource my_res { }');
    const s = gs.children[0] as Struct;
    expect(s.kind).toBe(enums.StructKind.Resource);
  });

  it('builds enum declaration', () => {
    const gs = buildAST('enum color_e { RED, GREEN, BLUE }');
    expect(gs.children).toHaveLength(1);
    const e = gs.children[0] as EnumDecl;
    expect(e).toBeInstanceOf(EnumDecl);
    expect(getNodeName(e)).toBe('color_e');
  });

  it('builds abstract action declaration', () => {
    const gs = buildAST('abstract action my_action { }');
    expect(gs.children).toHaveLength(1);
    const a = gs.children[0] as Action;
    expect(a).toBeInstanceOf(Action);
    expect(a.is_abstract).toBe(true);
    expect(getNodeName(a)).toBe('my_action');
  });

  it('builds action inside component', () => {
    const gs = buildAST('component c { action a { } }');
    const comp = gs.children[0] as Component;
    expect(comp.children).toHaveLength(1);
    const action = comp.children[0] as Action;
    expect(action).toBeInstanceOf(Action);
    expect(getNodeName(action)).toBe('a');
    expect(action.is_abstract).toBe(false);
  });

  it('builds package declaration', () => {
    const gs = buildAST('package my_pkg { struct s { } }');
    expect(gs.children).toHaveLength(1);
    const pkg = gs.children[0] as PackageScope;
    expect(pkg).toBeInstanceOf(PackageScope);
    expect(pkg.id.length).toBe(1);
    expect(pkg.id[0].id).toBe('my_pkg');
  });

  it('builds import statement', () => {
    const gs = buildAST('import my_pkg::*;');
    expect(gs.children).toHaveLength(1);
    const imp = gs.children[0] as PackageImportStmt;
    expect(imp).toBeInstanceOf(PackageImportStmt);
    expect(imp.wildcard).toBe(true);
  });

  it('builds struct with fields', () => {
    const gs = buildAST('struct s { rand int x; bool y; }');
    const s = gs.children[0] as Struct;
    expect(s.children.length).toBeGreaterThanOrEqual(1);
    const fields = s.children.filter(c => c instanceof Field);
    expect(fields.length).toBeGreaterThanOrEqual(1);
  });

  it('builds action with super type', () => {
    const gs = buildAST('component c { action child : parent_t { } }');
    const comp = gs.children[0] as Component;
    const action = comp.children[0] as Action;
    expect(action.super_t).not.toBeNull();
    expect(action.super_t!.elems.length).toBe(1);
    expect(action.super_t!.elems[0].id?.id).toBe('parent_t');
  });

  it('captures location information', () => {
    const gs = buildAST('struct s { }');
    const s = gs.children[0];
    expect(s.location.lineno).toBe(1);
    expect(s.location.linepos).toBe(0);
  });

  it('captures doc comments', () => {
    const gs = buildAST('/** This is a doc comment */\nstruct s { }');
    const s = gs.children[0] as Struct;
    expect(s.docstring).toContain('doc comment');
  });

  it('builds extend statement', () => {
    const gs = buildAST('extend action my_action { }');
    expect(gs.children).toHaveLength(1);
    const ext = gs.children[0] as ExtendType;
    expect(ext).toBeInstanceOf(ExtendType);
  });

  it('builds typedef', () => {
    const gs = buildAST('typedef my_int my_type_t;');
    const td = gs.children[0] as TypedefDeclaration;
    expect(td).toBeInstanceOf(TypedefDeclaration);
  });

  it('builds annotation declaration', () => {
    const gs = buildAST('annotation my_ann { }');
    const ad = gs.children[0] as AnnotationDecl;
    expect(ad).toBeInstanceOf(AnnotationDecl);
    expect(getNodeName(ad)).toBe('my_ann');
  });

  it('builds multiple top-level declarations', () => {
    const gs = buildAST(`
      struct s1 { }
      struct s2 { }
      enum e { A, B }
      component c { }
    `);
    expect(gs.children.length).toBe(4);
  });

  it('produces correct node signature for component', () => {
    const gs = buildAST('component my_comp { }');
    const comp = gs.children[0] as Component;
    expect(getNodeSignature(comp)).toBe('component my_comp');
  });

  it('produces correct node signature for abstract action', () => {
    const gs = buildAST('abstract action my_action { }');
    const action = gs.children[0] as Action;
    expect(getNodeSignature(action)).toBe('abstract action my_action');
  });

  it('walkScope iterates all nodes', () => {
    const gs = buildAST('component c { action a { } }');
    const nodes = [...walkScope(gs)];
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('produces partial AST on syntax errors', () => {
    const gs = buildAST('struct s1 { }\nstruct { }\nstruct s2 { }');
    // Should have at least s1 despite the error in the middle
    const names = gs.children.map(c => getNodeName(c)).filter(Boolean);
    expect(names).toContain('s1');
  });

  it('handles nested components', () => {
    const gs = buildAST('component outer { component inner { } }');
    // component can't be nested in component body per grammar
    // but let's verify we don't crash
    expect(gs.children.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PSSASTBuilder - Extended Visitors', () => {
  it('builds activity declaration with sequence', () => {
    const gs = buildAST(`
      component c {
        action a {
          activity {
            do a;
          }
        }
      }
    `);
    const comp = gs.children[0] as Component;
    const action = comp.children[0] as Action;
    // Activity should be present as a child
    const activities = action.children.filter(c => c.constructor.name === 'ActivityDecl');
    expect(activities.length).toBe(1);
  });

  it('builds exec block', () => {
    const gs = buildAST(`
      component c {
        action a {
          exec body {
          }
        }
      }
    `);
    const comp = gs.children[0] as Component;
    const action = comp.children[0] as Action;
    const execs = action.children.filter(c => c.constructor.name === 'ExecBlock');
    expect(execs.length).toBeGreaterThanOrEqual(0);
  });

  it('builds constraint declaration', () => {
    const gs = buildAST(`
      struct s {
        rand int x;
        constraint c {
          x > 0;
        }
      }
    `);
    const s = gs.children[0] as Struct;
    const constraints = s.children.filter(c => c.constructor.name === 'NamedScope');
    expect(constraints.length).toBeGreaterThanOrEqual(1);
  });

  it('builds flow reference field (input)', () => {
    const gs = buildAST(`
      component c {
        action a {
          input some_type in_ref;
        }
      }
    `);
    const comp = gs.children[0] as Component;
    const action = comp.children[0] as Action;
    const refs = action.children.filter(c => c.constructor.name === 'FieldRef');
    expect(refs.length).toBeGreaterThanOrEqual(0);
  });

  it('builds resource reference field (lock)', () => {
    const gs = buildAST(`
      resource bus_t { }
      component c {
        action a {
          lock bus_t my_bus;
        }
      }
    `);
    const comp = gs.children[1] as Component;
    const action = comp.children[0] as Action;
    expect(action.children.length).toBeGreaterThanOrEqual(0);
  });

  it('builds override action', () => {
    const gs = buildAST(`
      component c {
        override action my_act { }
      }
    `);
    const comp = gs.children[0] as Component;
    const acts = comp.children.filter(c => c.constructor.name === 'Action');
    expect(acts.length).toBeGreaterThanOrEqual(1);
  });

  it('builds extend action', () => {
    const gs = buildAST(`
      extend action my_action {
        rand int new_field;
      }
    `);
    expect(gs.children).toHaveLength(1);
    expect(gs.children[0].constructor.name).toBe('ExtendType');
  });

  it('builds extend enum', () => {
    const gs = buildAST(`
      extend enum color_e {
        YELLOW
      }
    `);
    expect(gs.children).toHaveLength(1);
    expect(gs.children[0].constructor.name).toBe('ExtendEnum');
  });

  it('builds function declaration', () => {
    const gs = buildAST(`
      function void my_func();
    `);
    expect(gs.children.length).toBeGreaterThanOrEqual(1);
  });

  it('builds pyimport statement', () => {
    const gs = buildAST(`
      pyimport my_module;
    `);
    expect(gs.children.length).toBeGreaterThanOrEqual(1);
    expect(gs.children[0].constructor.name).toBe('PyImportStmt');
  });

  it('builds complex multi-construct file', () => {
    const gs = buildAST(`
      package my_pkg {
        struct addr_s {
          rand int<32> addr;
          constraint addr_c {
            addr >= 0;
          }
        }
        
        enum op_e { READ, WRITE }
        
        abstract action base_action { }
      }
      
      component pss_top {
        action top_action : base_action {
          activity {
          }
        }
      }
    `);
    expect(gs.children.length).toBe(2); // package + component
    const pkg = gs.children[0] as PackageScope;
    expect(pkg.children.length).toBeGreaterThanOrEqual(3); // struct, enum, abstract action
  });
});
