/**
 * The §3 construct matrix from `docs/design/pss31-extension-plan.md`, one
 * `describe` per row. Every row asserts the source parses without a syntax
 * error; the rows the plan marks ✱ also assert the AST shape, because those
 * are the ones a consumer (a service, or another psstools front end) can
 * observe.
 *
 * Where a row's AST shape is not built yet, the test says so and pins the
 * current behaviour rather than being omitted -- see the `constraint bodies`
 * describe at the bottom, which is the recorded Phase 2 gap.
 */
import { describe, it, expect } from 'vitest';
import { parseSources } from '../../helpers/ParseHelper.js';
import * as AST from '../../../src/core/ast/generated/index.js';
import { enums, flags } from '../../../src/core/ast/generated/index.js';

/** Parse and assert the source is syntactically clean, returning the AST. */
function build(source: string): AST.GlobalScope {
  const { scopes, diagnostics } = parseSources([source]);
  expect(
    diagnostics.map(d => `${d.range.start.line + 1}:${d.range.start.character + 1} ${d.message}`),
  ).toEqual([]);
  return scopes[0];
}

/** Parse and assert the source is rejected. */
function expectSyntaxError(source: string): void {
  expect(parseSources([source]).diagnostics.length).toBeGreaterThan(0);
}

/**
 * Every node of a given class, in source order -- the traversal is pre-order
 * so a test can index into the result and mean "the first one written".
 */
function findAll<T extends AST.ScopeChild>(
  root: AST.ScopeChild,
  cls: new (...args: never[]) => T,
): T[] {
  const out: T[] = [];
  const visit = (node: AST.ScopeChild): void => {
    if (node instanceof cls) out.push(node);
    if (node instanceof AST.Scope) node.children.forEach(visit);
  };
  visit(root);
  return out;
}

/** The first node of a given class, in source order. */
function find<T extends AST.ScopeChild>(
  root: AST.ScopeChild,
  cls: new (...args: never[]) => T,
): T {
  const all = findAll(root, cls);
  if (all.length === 0) throw new Error(`no ${cls.name} in tree`);
  return all[0];
}

describe('PSS 3.1 constructs', () => {
  describe('constraints', () => {
    it('parses a soft constraint', () => {
      build('struct s { rand int x; constraint c { soft x > 10; } }');
    });

    it('parses unique with a single operand', () => {
      build('struct s { rand int arr[4]; constraint c { unique arr; } }');
    });

    it('parses unique over a range slice', () => {
      build('struct s { rand int arr[8]; constraint c { unique arr[2..5]; } }');
    });

    it('parses a dist directive', () => {
      build('struct s { rand int x; constraint c { dist x in [1 := 5, 2 := 3]; } }');
    });

    it('parses range slices with an open bound', () => {
      build('struct s { rand int arr[8]; constraint c { unique arr[2..]; unique arr[..5]; } }');
    });
  });

  describe('enum base type ✱', () => {
    it('builds EnumDecl.base_type for an integer base', () => {
      const gs = build('enum e : bit[4] { A, B }');
      const e = find(gs, AST.EnumDecl);
      expect(e.base_type).toBeInstanceOf(AST.DataTypeInt);
      expect((e.base_type as AST.DataTypeInt).is_signed).toBe(false);
      expect(e.items.map(i => i.name?.id)).toEqual(['A', 'B']);
    });

    it('leaves base_type null when the enum has none', () => {
      expect(find(build('enum e { A }'), AST.EnumDecl).base_type).toBeNull();
    });
  });

  describe('float types ✱', () => {
    it('builds DataTypeFloat and distinguishes the two widths', () => {
      const gs = build('struct s { float32 a; float64 b; }');
      const [a, b] = findAll(gs, AST.Field);
      expect(a.type).toBeInstanceOf(AST.DataTypeFloat);
      expect((a.type as AST.DataTypeFloat).is_float64).toBe(false);
      expect((b.type as AST.DataTypeFloat).is_float64).toBe(true);
    });

    it('parses float literals', () => {
      build('struct s { float64 a = 1.5; float64 b = 1.5e3; float64 c = 2E-4; }');
    });
  });

  describe('literals', () => {
    it('parses a binary literal', () => {
      build('struct s { static const int x = 0b1010; }');
    });
  });

  describe('multi-dimensional arrays ✱', () => {
    it('accepts multiple array dimensions on a flow object reference', () => {
      const gs = build('package p { buffer b { } component c { action a { input b b_i[2][3]; } } }');
      expect(find(gs, AST.FieldRef).name?.id).toBe('b_i');
    });

    it('accepts multiple array dimensions on a component field', () => {
      const gs = build('component c { int m[2][3]; }');
      expect(find(gs, AST.Field).name?.id).toBe('m');
    });
  });

  describe('component data qualifiers ✱', () => {
    it('sets FieldAttr.Mutable for a mutable attribute', () => {
      const gs = build('component c { mutable int total; }');
      expect(find(gs, AST.Field).attr & flags.FieldAttr.Mutable).toBeTruthy();
    });

    it('sets FieldAttr.Instance for an instance attribute', () => {
      const gs = build('component c { instance int i; }');
      expect(find(gs, AST.Field).attr & flags.FieldAttr.Instance).toBeTruthy();
    });

    it('still sets static const, which shares the qualifier slot', () => {
      const f = find(build('component c { static const int k = 1; }'), AST.Field);
      expect(f.attr & flags.FieldAttr.Static).toBeTruthy();
      expect(f.attr & flags.FieldAttr.Const).toBeTruthy();
    });
  });

  describe('type categories ✱', () => {
    it('builds the plain and ref parameter categories', () => {
      const gs = build(
        'package p { function void f(numeric n, struct s, ref action a, ref component c, type T); }',
      );
      const proto = find(gs, AST.FunctionDefinition).proto!;
      expect(proto.parameters.map(p => [p.name?.id, enums.FunctionParamDeclKind[p.kind]])).toEqual([
        ['n', 'ParamKind_Numeric'],
        ['s', 'ParamKind_Struct'],
        ['a', 'ParamKind_RefAction'],
        ['c', 'ParamKind_RefComponent'],
        ['T', 'ParamKind_Type'],
      ]);
    });

    it('parses a monitor template parameter', () => {
      build('monitor m { } struct s <monitor M> { }');
    });
  });

  describe('platform-qualified functions ✱', () => {
    it('sets is_target for a target function', () => {
      const proto = find(build('package p { target function void w(int a); }'), AST.FunctionDefinition).proto!;
      expect(proto.is_target).toBe(true);
      expect(proto.is_solve).toBe(false);
    });

    it('sets both flags for `target solve`, which are not exclusive', () => {
      const proto = find(build('package p { target solve function void w(); }'), AST.FunctionDefinition).proto!;
      expect(proto.is_target).toBe(true);
      expect(proto.is_solve).toBe(true);
    });

    it('sets is_solve alone for a solve function', () => {
      const proto = find(build('package p { solve function void w(); }'), AST.FunctionDefinition).proto!;
      expect(proto.is_target).toBe(false);
      expect(proto.is_solve).toBe(true);
    });

    it('sets is_pure and carries the return type', () => {
      const proto = find(build('package p { pure function bit[8] w(); }'), AST.FunctionDefinition).proto!;
      expect(proto.is_pure).toBe(true);
      expect(proto.rtype).toBeInstanceOf(AST.DataTypeInt);
    });

    it('spells a void return as a null rtype', () => {
      expect(find(build('package p { function void w(); }'), AST.FunctionDefinition).proto!.rtype).toBeNull();
    });

    it('carries parameter names, types, and direction', () => {
      const proto = find(
        build('package p { function void w(int a, output bit[4] b); }'),
        AST.FunctionDefinition,
      ).proto!;
      expect(proto.parameters).toHaveLength(2);
      expect(proto.parameters[0].name?.id).toBe('a');
      expect(proto.parameters[0].type).toBeInstanceOf(AST.DataTypeInt);
      expect(proto.parameters[0].dir).toBe(enums.ParamDir.ParamDir_Default);
      expect(proto.parameters[1].dir).toBe(enums.ParamDir.ParamDir_Out);
    });
  });

  describe('exec blocks ✱', () => {
    it('builds a pre_body exec block', () => {
      const gs = build('component c { action a { exec pre_body { } } }');
      expect(find(gs, AST.ExecBlock).kind).toBe(enums.ExecKind.ExecKind_PreBody);
    });

    it('builds init_up and init_down', () => {
      const gs = build('component c { exec init_up { } exec init_down { } }');
      const kinds = findAll(gs, AST.ExecBlock).map(e => e.kind).sort();
      expect(kinds).toEqual(
        [enums.ExecKind.ExecKind_InitDown, enums.ExecKind.ExecKind_InitUp].sort(),
      );
    });

    it('builds a tagged target-code exec block', () => {
      const gs = build('component c { exec header C = tag_s {.name="h"}: """int x;"""; }');
      const eb = find(gs, AST.ExecTargetTemplateBlock);
      expect(eb.kind).toBe(enums.ExecKind.ExecKind_Header);
      expect(eb.language).toBe('C');
      expect(eb.data).toBe('int x;');
      expect(eb.tag?.type?.elems.map(e => e.id?.id)).toEqual(['tag_s']);
    });

    it('leaves the tag null when the block has none', () => {
      const gs = build('component c { exec header C = """int x;"""; }');
      expect(find(gs, AST.ExecTargetTemplateBlock).tag).toBeNull();
    });

    it('builds `exec file` with a template filename', () => {
      const gs = build('component c { exec file """out_{{i}}.c""" = """body"""; }');
      const eb = find(gs, AST.ExecTargetTemplateBlock);
      expect(eb.kind).toBe(enums.ExecKind.ExecKind_File);
      expect(eb.filename).toBe('out_{{i}}.c');
      expect(eb.data).toBe('body');
    });

    it('strips the quoting of a double-quoted body without mangling it', () => {
      const gs = build('component c { exec header C = "int x;"; }');
      expect(find(gs, AST.ExecTargetTemplateBlock).data).toBe('int x;');
    });
  });

  describe('annotations ✱', () => {
    it('attaches a braced element annotation to the declaration that follows', () => {
      const gs = build('package p { @desc_s {.desc = "block"} struct s { } }');
      const s = find(gs, AST.Struct);
      expect(s.annotations).toHaveLength(1);
      expect(s.annotations[0].is_standalone).toBe(false);
      expect(s.annotations[0].type?.elems.map(e => e.id?.id)).toEqual(['desc_s']);
      expect(s.annotations[0].parameters.map(p => p.name?.id)).toEqual(['desc']);
    });

    it('makes a standalone annotation a scope child of its own', () => {
      const gs = build('package p { @file_note_s {.text = "gen"}; struct s { } }');
      const ann = find(gs, AST.Annotation);
      expect(ann.is_standalone).toBe(true);
      // It must not also steal the following declaration's annotation slot.
      expect(find(gs, AST.Struct).annotations).toHaveLength(0);
    });

    it('attaches multiple element annotations to one declaration', () => {
      const gs = build('package p { @a {} @b {} struct s { } }');
      expect(find(gs, AST.Struct).annotations.map(a => a.type?.elems[0].id?.id)).toEqual(['a', 'b']);
    });

    it('accepts a parameterless annotation', () => {
      const gs = build('package p { @marker struct s { } }');
      expect(find(gs, AST.Struct).annotations[0].parameters).toHaveLength(0);
    });

    it('accepts annotations in struct, action, component, and activity scopes', () => {
      const gs = build(`
        package p {
          struct s { @f {} int x; }
          component c {
            @g {} int y;
            action a {
              @h {} int z;
              activity { @i {} }
            }
          }
        }
      `);
      // Four applications, each attached or standalone -- none dropped.
      const attached = findAll(gs, AST.ScopeChild).flatMap(n => n.annotations);
      const standalone = findAll(gs, AST.Annotation);
      expect(attached.length + standalone.length).toBe(4);
    });
  });

  describe('compile if', () => {
    it('parses a braced compile if', () => {
      build('package p { compile if (1) { struct s { } } else { struct t { } } }');
    });

    it('still parses the deprecated brace-less form (PSS104 is Phase 4)', () => {
      build('package p { compile if (1) struct s { } }');
    });
  });

  describe('template strings', () => {
    // Scanning these into a TemplateString tree is Phase 5; for now the body is
    // kept verbatim in `data`, which is what these pin.
    it('keeps a mustache body verbatim', () => {
      const gs = build('component c { exec body C = """x = {{ a }};"""; }');
      expect(find(gs, AST.ExecTargetTemplateBlock).data).toBe('x = {{ a }};');
    });

    it('keeps control and comment elements verbatim', () => {
      const gs = build(
        'component c { exec body C = """{% if a %}x{% endif %}{# note #}"""; }',
      );
      expect(find(gs, AST.ExecTargetTemplateBlock).data).toBe('{% if a %}x{% endif %}{# note #}');
    });

    it('does not build a TemplateString tree yet', () => {
      const gs = build('component c { exec body C = """{{ a }}"""; }');
      expect(find(gs, AST.ExecTargetTemplateBlock).template).toBeNull();
    });
  });

  describe('negative cases', () => {
    // Marker IDs (PSS0xx) are Phase 3. These assert only that the construct is
    // *rejected* -- when the classifier lands, they gain a code assertion.
    it('rejects `soft` as an identifier, which is the 3.1 reserved-word break', () => {
      expectSyntaxError('struct s { int soft; }');
    });

    it('rejects `mutable` as an identifier', () => {
      expectSyntaxError('struct s { int mutable; }');
    });

    it('rejects `ref struct`, since struct is a plain category in 3.1', () => {
      expectSyntaxError('package p { function void f(ref struct s); }');
    });

    it('rejects the PSS 3.0 parenthesized annotation form', () => {
      expectSyntaxError('package p { @desc_s(desc = "block") struct s { } }');
    });

    it('rejects an unclosed component brace', () => {
      expectSyntaxError('component c { action a { }');
    });
  });

  describe('constraint bodies: recorded Phase 2 gap', () => {
    // The builder constructs no expressions and no constraint statements: a
    // constraint block's items become bare ScopeChild placeholders. Every 3.1
    // constraint feature above therefore parses but has no AST shape to assert
    // -- ConstraintStmtSoft, ConstraintStmtDist, DistItem and ExprSliceRange
    // are all generated and all unused. This pins that so the gap closing is a
    // visible test change rather than a silent one.
    it('builds constraint items as untyped placeholders', () => {
      const gs = build('struct s { rand int x; constraint c { soft x > 10; x < 20; } }');
      const c = findAll(gs, AST.NamedScope).find(n => n.name?.id === 'c')!;
      expect(c.children).toHaveLength(2);
      for (const item of c.children) {
        expect(item.constructor).toBe(AST.ScopeChild);
      }
      expect(findAll(gs, AST.ConstraintStmtSoft)).toHaveLength(0);
    });
  });
});
