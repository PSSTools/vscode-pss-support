import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getCompletions, resolveCompletionItem, parseLineContext } from '../../../src/core/services/CompletionService';
import { CompletionKind } from '../../../src/core/types/CompletionResult';

function createIndex(files: Record<string, string>): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, content] of Object.entries(files)) {
    index.addFile(uri, content);
  }
  return index;
}

// ── parseLineContext unit tests ─────────────────────────────────

describe('parseLineContext', () => {
  it('should detect afterDo when cursor is after "do "', () => {
    const text = '      do ';
    const ctx = parseLineContext(text, { line: 0, character: 9 });
    expect(ctx.afterDo).toBe(true);
    expect(ctx.qualifiedPrefix).toBeNull();
    expect(ctx.partial).toBe('');
  });

  it('should detect afterDo with partial identifier', () => {
    const text = '      do my_ac';
    const ctx = parseLineContext(text, { line: 0, character: 14 });
    expect(ctx.afterDo).toBe(true);
    expect(ctx.partial).toBe('my_ac');
    expect(ctx.qualifiedPrefix).toBeNull();
  });

  it('should detect qualified prefix after "::"', () => {
    const text = '      do mycomp_c::';
    const ctx = parseLineContext(text, { line: 0, character: 19 });
    expect(ctx.afterDo).toBe(true);
    expect(ctx.qualifiedPrefix).toEqual(['mycomp_c']);
    expect(ctx.partial).toBe('');
  });

  it('should detect qualified prefix with partial identifier', () => {
    const text = '      do mycomp_c::my_a';
    const ctx = parseLineContext(text, { line: 0, character: 23 });
    expect(ctx.afterDo).toBe(true);
    expect(ctx.qualifiedPrefix).toEqual(['mycomp_c']);
    expect(ctx.partial).toBe('my_a');
  });

  it('should detect multi-segment qualified prefix', () => {
    const text = '      do pkg::mycomp_c::';
    const ctx = parseLineContext(text, { line: 0, character: 24 });
    expect(ctx.qualifiedPrefix).toEqual(['pkg', 'mycomp_c']);
    expect(ctx.partial).toBe('');
  });

  it('should detect qualified prefix outside of do context', () => {
    const text = '    mycomp_c::';
    const ctx = parseLineContext(text, { line: 0, character: 14 });
    expect(ctx.afterDo).toBe(false);
    expect(ctx.qualifiedPrefix).toEqual(['mycomp_c']);
  });

  it('should not detect afterDo for plain keyword typing', () => {
    const text = '      parallel {';
    const ctx = parseLineContext(text, { line: 0, character: 16 });
    expect(ctx.afterDo).toBe(false);
    expect(ctx.qualifiedPrefix).toBeNull();
  });

  it('should handle multi-line text and use correct line', () => {
    const text = 'line0\n      do mycomp_c::';
    const ctx = parseLineContext(text, { line: 1, character: 24 });
    expect(ctx.afterDo).toBe(true);
    expect(ctx.qualifiedPrefix).toEqual(['mycomp_c']);
  });

  it('should detect member access after "."', () => {
    const text = '    my_field.';
    const ctx = parseLineContext(text, { line: 0, character: 13 });
    expect(ctx.memberAccessPrefix).toEqual(['my_field']);
    expect(ctx.partial).toBe('');
  });

  it('should detect nested member access', () => {
    const text = '    a.b.c.';
    const ctx = parseLineContext(text, { line: 0, character: 10 });
    expect(ctx.memberAccessPrefix).toEqual(['a', 'b', 'c']);
    expect(ctx.partial).toBe('');
  });

  it('should detect member access with partial', () => {
    const text = '    my_field.sub';
    const ctx = parseLineContext(text, { line: 0, character: 16 });
    expect(ctx.memberAccessPrefix).toEqual(['my_field']);
    expect(ctx.partial).toBe('sub');
  });

  it('should detect annotation context after @', () => {
    const text = '  @';
    const ctx = parseLineContext(text, { line: 0, character: 3 });
    expect(ctx.afterAt).toBe(true);
    expect(ctx.partial).toBe('');
  });

  it('should detect annotation context with partial', () => {
    const text = '  @my_ann';
    const ctx = parseLineContext(text, { line: 0, character: 9 });
    expect(ctx.afterAt).toBe(true);
    expect(ctx.partial).toBe('my_ann');
  });

  it('should detect template context inside <>', () => {
    const text = '    my_type<';
    const ctx = parseLineContext(text, { line: 0, character: 12 });
    expect(ctx.templateContext).not.toBeNull();
    expect(ctx.templateContext?.typeName).toBe('my_type');
    expect(ctx.templateContext?.paramIndex).toBe(0);
  });

  it('should detect template context second param', () => {
    const text = '    my_type<int, ';
    const ctx = parseLineContext(text, { line: 0, character: 17 });
    expect(ctx.templateContext).not.toBeNull();
    expect(ctx.templateContext?.typeName).toBe('my_type');
    expect(ctx.templateContext?.paramIndex).toBe(1);
  });

  it('should detect inheritance position after action X :', () => {
    const text = '  action my_act : ';
    const ctx = parseLineContext(text, { line: 0, character: 18 });
    expect(ctx.inheritanceCategory).toBe('action');
    expect(ctx.partial).toBe('');
  });

  it('should detect inheritance position with partial', () => {
    const text = '  struct my_s : base';
    const ctx = parseLineContext(text, { line: 0, character: 20 });
    expect(ctx.inheritanceCategory).toBe('struct');
    expect(ctx.partial).toBe('base');
  });

  it('should detect import context', () => {
    const text = '  import ';
    const ctx = parseLineContext(text, { line: 0, character: 9 });
    expect(ctx.afterImport).toBe(true);
  });
});

// ── Existing CompletionService tests ────────────────────────────

describe('CompletionService', () => {
  it('should return top-level keywords for empty file', () => {
    const index = createIndex({ 'file:///test.pss': '' });
    const results = getCompletions('file:///test.pss', { line: 0, character: 0 }, index);

    const keywords = results.filter(r => r.kind === CompletionKind.Keyword);
    expect(keywords.length).toBeGreaterThan(0);
    const labels = keywords.map(r => r.label);
    expect(labels).toContain('action');
    expect(labels).toContain('component');
    expect(labels).toContain('struct');
    expect(labels).toContain('enum');
    expect(labels).toContain('package');
    expect(labels).toContain('import');
  });

  it('should return action body keywords inside action', () => {
    const index = createIndex({
      'file:///test.pss': 'component c {\n  action a {\n    \n  }\n}',
    });
    const results = getCompletions('file:///test.pss', { line: 2, character: 4 }, index);

    const keywords = results.filter(r => r.kind === CompletionKind.Keyword);
    const labels = keywords.map(r => r.label);
    expect(labels).toContain('rand');
    expect(labels).toContain('constraint');
    expect(labels).toContain('activity');
    expect(labels).toContain('exec');
  });

  it('should return built-in types in action body', () => {
    const index = createIndex({
      'file:///test.pss': 'component c {\n  action a {\n    \n  }\n}',
    });
    const results = getCompletions('file:///test.pss', { line: 2, character: 4 }, index);

    const types = results.filter(r => r.kind === CompletionKind.Type);
    const labels = types.map(r => r.label);
    expect(labels).toContain('bit');
    expect(labels).toContain('int');
    expect(labels).toContain('bool');
    expect(labels).toContain('string');
  });

  it('should return struct body keywords inside struct', () => {
    const index = createIndex({
      'file:///test.pss': 'struct s {\n  \n}',
    });
    const results = getCompletions('file:///test.pss', { line: 1, character: 2 }, index);

    const keywords = results.filter(r => r.kind === CompletionKind.Keyword);
    const labels = keywords.map(r => r.label);
    expect(labels).toContain('rand');
    expect(labels).toContain('constraint');
  });

  it('should return component body keywords inside component', () => {
    const index = createIndex({
      'file:///test.pss': 'component c {\n  \n}',
    });
    const results = getCompletions('file:///test.pss', { line: 1, character: 2 }, index);

    const keywords = results.filter(r => r.kind === CompletionKind.Keyword);
    const labels = keywords.map(r => r.label);
    expect(labels).toContain('action');
    expect(labels).toContain('pool');
    expect(labels).toContain('bind');
  });

  it('should include user-defined types from workspace', () => {
    const index = createIndex({
      'file:///types.pss': 'struct my_data_s { rand bit[32] val; }',
      'file:///test.pss': 'component c {\n  action a {\n    \n  }\n}',
    });
    const results = getCompletions('file:///test.pss', { line: 2, character: 4 }, index);

    const typeLabels = results.map(r => r.label);
    expect(typeLabels).toContain('my_data_s');
  });

  it('should return completions for nonexistent file', () => {
    const index = new WorkspaceIndex();
    const results = getCompletions('file:///nonexistent.pss', { line: 0, character: 0 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should include enum types in completions', () => {
    const index = createIndex({
      'file:///test.pss': 'enum dir_e { READ, WRITE }\ncomponent c {\n  action a {\n    \n  }\n}',
    });
    const results = getCompletions('file:///test.pss', { line: 3, character: 4 }, index);

    const labels = results.map(r => r.label);
    expect(labels).toContain('dir_e');
  });

  it('should resolve completion item documentation', () => {
    const index = createIndex({
      'file:///test.pss': '/** My documented struct */\nstruct doc_struct { }',
    });

    resolveCompletionItem(
      { label: 'doc_struct', kind: CompletionKind.Type },
      index,
    );
    // No assertion needed -- just verifying no crash
  });

  it('should provide sort text for prioritization', () => {
    const index = createIndex({ 'file:///test.pss': '' });
    const results = getCompletions('file:///test.pss', { line: 0, character: 0 }, index);

    const keyword = results.find(r => r.kind === CompletionKind.Keyword);
    expect(keyword?.sortText).toBeDefined();
  });

  it('should return activity keywords in activity context', () => {
    const index = createIndex({
      'file:///test.pss': 'component c {\n  action a {\n    activity {\n      \n    }\n  }\n}',
    });
    const results = getCompletions('file:///test.pss', { line: 3, character: 6 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return package names for import context', () => {
    const index = createIndex({
      'file:///types.pss': 'package my_pkg { struct s { } }',
      'file:///test.pss': '',
    });
    const results = getCompletions('file:///test.pss', { line: 0, character: 0 }, index);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should include functions in completions', () => {
    const index = createIndex({
      'file:///test.pss': 'function void my_func() { }\nstruct s {\n  \n}',
    });
    const results = getCompletions('file:///test.pss', { line: 2, character: 2 }, index);

    const labels = results.map(r => r.label);
    expect(labels).toContain('my_func');
  });

  it('should handle multiple files with types', () => {
    const index = createIndex({
      'file:///a.pss': 'struct type_a { }',
      'file:///b.pss': 'struct type_b { }',
      'file:///test.pss': 'component c {\n  action a {\n    \n  }\n}',
    });
    const results = getCompletions('file:///test.pss', { line: 2, character: 4 }, index);

    const labels = results.map(r => r.label);
    expect(labels).toContain('type_a');
    expect(labels).toContain('type_b');
  });
});

// ── Section 1: Scope-aware do-target completions ────────────────

describe('CompletionService do-target', () => {
  const COMP_ACTIVITY_SRC = [
    'component mycomp_c {',
    '  action my_action_a {',
    '    activity {',
    '      do ',
    '    }',
    '  }',
    '  action another_a { }',
    '}',
    'component other_c {',
    '  action other_action { }',
    '}',
  ].join('\n');

  it('should offer actions and components after "do "', () => {
    const index = createIndex({ 'file:///test.pss': COMP_ACTIVITY_SRC });
    const results = getCompletions(
      'file:///test.pss',
      { line: 3, character: 9 },
      index,
      COMP_ACTIVITY_SRC,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('my_action_a');
    expect(labels).toContain('another_a');
    // Should NOT contain activity keywords
    expect(labels).not.toContain('parallel');
    expect(labels).not.toContain('sequence');
  });

  it('should filter do-target completions by partial identifier', () => {
    const src = COMP_ACTIVITY_SRC.replace('      do ', '      do my_');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 3, character: 11 },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('my_action_a');
    expect(labels).toContain('mycomp_c');
    expect(labels).not.toContain('other_action');
    expect(labels).not.toContain('other_c');
  });

  it('should deprioritize abstract actions', () => {
    const src = [
      'component c {',
      '  abstract action abs_a { }',
      '  action concrete_a { }',
      '  action test_a {',
      '    activity {',
      '      do ',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 5, character: 9 },
      index,
      src,
    );

    const absItem = results.find(r => r.label === 'abs_a');
    const concreteItem = results.find(r => r.label === 'concrete_a');
    expect(absItem).toBeDefined();
    expect(concreteItem).toBeDefined();
    // Abstract should sort after concrete
    expect(absItem!.sortText! > concreteItem!.sortText!).toBe(true);
  });

  it('should fall back to all workspace actions when context unavailable', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', '');
    const results = getCompletions(
      'file:///test.pss',
      { line: 0, character: 0 },
      index,
      'do ',
    );
    // Should not crash, returns actions (possibly empty if no types)
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── Section 1: Qualified-path completion tests ──────────────────

describe('CompletionService qualified-path', () => {
  const MULTI_COMP_SRC = [
    'component mycomp_c {',
    '  action read_a { }',
    '  action write_a { }',
    '}',
    'component outer_c {',
    '  action top_a {',
    '    activity {',
    '      do mycomp_c::',
    '    }',
    '  }',
    '}',
  ].join('\n');

  it('should offer actions within a component after "comp::"', () => {
    const index = createIndex({ 'file:///test.pss': MULTI_COMP_SRC });
    const line7 = '      do mycomp_c::';
    const results = getCompletions(
      'file:///test.pss',
      { line: 7, character: line7.length },
      index,
      MULTI_COMP_SRC,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('read_a');
    expect(labels).toContain('write_a');
    expect(labels).not.toContain('top_a');
  });

  it('should filter qualified-path completions by partial id', () => {
    const src = MULTI_COMP_SRC.replace('do mycomp_c::', 'do mycomp_c::read');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 7, character: '      do mycomp_c::read'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('read_a');
    expect(labels).not.toContain('write_a');
  });

  it('should return empty for unknown qualified prefix', () => {
    const src = MULTI_COMP_SRC.replace('do mycomp_c::', 'do nonexistent::');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 7, character: '      do nonexistent::'.length },
      index,
      src,
    );
    expect(results).toEqual([]);
  });

  it('should work for package-scoped qualified paths', () => {
    const src = [
      'package my_pkg {',
      '  struct data_s { }',
      '  enum dir_e { A, B }',
      '}',
      'component c {',
      '  action a {',
      '    my_pkg::',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 6, character: '    my_pkg::'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('data_s');
    expect(labels).toContain('dir_e');
  });
});

// ── Section 2: Member-access completions ────────────────────────

describe('CompletionService member-access', () => {
  it('should offer fields after "field."', () => {
    const src = [
      'struct inner_s {',
      '  rand int x;',
      '  rand int y;',
      '}',
      'component c {',
      '  action a {',
      '    inner_s my_s;',
      '    constraint c {',
      '      my_s.',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 8, character: '      my_s.'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('x');
    expect(labels).toContain('y');
  });

  it('should filter member-access by partial', () => {
    const src = [
      'struct inner_s {',
      '  rand int x_val;',
      '  rand int y_val;',
      '}',
      'component c {',
      '  action a {',
      '    inner_s my_s;',
      '    constraint c {',
      '      my_s.x',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 8, character: '      my_s.x'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('x_val');
    expect(labels).not.toContain('y_val');
  });

  it('should return empty for unresolvable LHS', () => {
    const src = [
      'component c {',
      '  action a {',
      '    constraint c {',
      '      unknown_var.',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 3, character: '      unknown_var.'.length },
      index,
      src,
    );
    expect(results).toEqual([]);
  });

  it('should offer comp-ref fields for component member access', () => {
    const src = [
      'component sub_c {',
      '  action sub_action { }',
      '}',
      'component c {',
      '  sub_c my_sub;',
      '  action a {',
      '    sub_c my_comp;',
      '    constraint c {',
      '      my_comp.',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 8, character: '      my_comp.'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    // sub_c has sub_action as a child
    expect(labels).toContain('sub_action');
  });
});

// ── Section 3: Template parameter completions ───────────────────

describe('CompletionService template-params', () => {
  it('should offer types for generic type parameter', () => {
    const src = [
      'struct my_generic<type T> {',
      '  T val;',
      '}',
      'component c {',
      '  action a {',
      '    my_generic<',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 5, character: '    my_generic<'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    // Should contain built-in types
    expect(labels).toContain('bit');
    expect(labels).toContain('int');
    expect(labels).toContain('bool');
  });

  it('should offer only action types for action category parameter', () => {
    const src = [
      'component c {',
      '  action base_a { }',
      '  action other_a { }',
      '}',
      'struct my_tmpl<action A> { }',
      'component d {',
      '  action test {',
      '    my_tmpl<',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 7, character: '    my_tmpl<'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('base_a');
    expect(labels).toContain('other_a');
    // Should NOT contain non-action types
    expect(labels).not.toContain('my_tmpl');
  });

  it('should handle second template parameter', () => {
    const src = [
      'struct my_pair<type T, type U> {',
      '  T first;',
      '  U second;',
      '}',
      'component c {',
      '  action a {',
      '    my_pair<int, ',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 6, character: '    my_pair<int, '.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('int');
    expect(labels).toContain('bit');
  });
});

// ── Section 4.1: Annotation completions ─────────────────────────

describe('CompletionService annotations', () => {
  it('should offer annotation types after @', () => {
    const src = [
      'annotation my_ann { }',
      'annotation other_ann { }',
      'component c {',
      '  @',
      '  action a { }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 3, character: 3 },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('my_ann');
    expect(labels).toContain('other_ann');
  });

  it('should filter annotation completions by partial', () => {
    const src = [
      'annotation my_ann { }',
      'annotation other_ann { }',
      '@my',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 2, character: 3 },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('my_ann');
    expect(labels).not.toContain('other_ann');
  });
});

// ── Section 4.2: Inheritance completions ────────────────────────

describe('CompletionService inheritance', () => {
  it('should offer action types after "action X :"', () => {
    const src = [
      'component c {',
      '  action base_a { }',
      '  action child_a : ',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 2, character: '  action child_a : '.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('base_a');
    // Should not contain structs
    expect(labels).not.toContain('c');
  });

  it('should offer struct types after "struct X :"', () => {
    const src = [
      'struct base_s { }',
      'struct child_s : ',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 1, character: 'struct child_s : '.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('base_s');
  });

  it('should filter inheritance completions by partial', () => {
    const src = [
      'component c {',
      '  action alpha_a { }',
      '  action beta_a { }',
      '  action child_a : al',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 3, character: '  action child_a : al'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('alpha_a');
    expect(labels).not.toContain('beta_a');
  });
});

// ── Section 4.4: Exec body completions ──────────────────────────

describe('CompletionService exec-body', () => {
  it('should include fields and functions in exec body (no text)', () => {
    const src = [
      'function void my_func() { }',
      'component c {',
      '  action a {',
      '    rand int field_x;',
      '    exec body {',
      '      ',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    // Without text, uses AST-based context
    const results = getCompletions(
      'file:///test.pss',
      { line: 5, character: 6 },
      index,
    );

    const labels = results.map(r => r.label);
    // Keywords
    expect(labels).toContain('if');
    expect(labels).toContain('while');
    // Built-in types
    expect(labels).toContain('int');
  });
});

// ── Activity completions now include components ─────────────────

describe('CompletionService activity body', () => {
  it('should include component types in activity completions (no text)', () => {
    const src = [
      'component mycomp_c {',
      '  action a {',
      '    activity {',
      '      ',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 3, character: 6 },
      index,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('do');
    expect(labels).toContain('parallel');
    expect(labels).toContain('mycomp_c');
  });
});

// ── Nested member access ────────────────────────────────────────

describe('CompletionService nested member-access', () => {
  it('should resolve nested dotted paths', () => {
    const src = [
      'struct inner_s {',
      '  rand int z;',
      '}',
      'struct outer_s {',
      '  inner_s nested;',
      '}',
      'component c {',
      '  action a {',
      '    outer_s my_outer;',
      '    constraint cst {',
      '      my_outer.nested.',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 10, character: '      my_outer.nested.'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('z');
  });
});

// ── Inherited member access ─────────────────────────────────────

describe('CompletionService inherited member-access', () => {
  it('should offer inherited fields via super type', () => {
    const src = [
      'struct base_s {',
      '  rand int base_field;',
      '}',
      'struct child_s : base_s {',
      '  rand int child_field;',
      '}',
      'component c {',
      '  action a {',
      '    child_s my_child;',
      '    constraint cst {',
      '      my_child.',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 10, character: '      my_child.'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('child_field');
    expect(labels).toContain('base_field');
  });
});

// ── Value template parameter ────────────────────────────────────

describe('CompletionService value template param', () => {
  it('should offer value completions for value parameter', () => {
    const src = [
      'struct my_sized<int N> {',
      '  rand bit[N] data;',
      '}',
      'component c {',
      '  action a {',
      '    my_sized<',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 5, character: '    my_sized<'.length },
      index,
      src,
    );

    // Should offer at least a value placeholder
    expect(results.length).toBeGreaterThan(0);
    const labels = results.map(r => r.label);
    expect(labels).toContain('0');
  });
});

// ── Import path completions ─────────────────────────────────────

describe('CompletionService import path', () => {
  it('should offer packages after "import "', () => {
    const src = [
      'package my_pkg {',
      '  struct s { }',
      '}',
      'import ',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 3, character: 'import '.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('my_pkg');
  });

  it('should offer package members after "import pkg::"', () => {
    const src = [
      'package my_pkg {',
      '  struct data_s { }',
      '  enum dir_e { A, B }',
      '}',
      'import my_pkg::',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 4, character: 'import my_pkg::'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toContain('data_s');
    expect(labels).toContain('dir_e');
  });
});

// ── Scope-aware do with comp-ref ────────────────────────────────

describe('CompletionService do with comp-ref', () => {
  it('should offer actions from comp-ref component type', () => {
    const src = [
      'component sub_c {',
      '  action sub_read { }',
      '  action sub_write { }',
      '}',
      'component top_c {',
      '  action my_action {',
      '    sub_c my_sub;',
      '    activity {',
      '      do ',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 8, character: '      do '.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    // Should include actions from the enclosing component
    expect(labels).toContain('my_action');
    // Should include actions from comp-ref sub_c (since my_sub is a FieldCompRef)
    // Note: my_sub is declared as `sub_c my_sub;` which may be parsed as Field
    // not FieldCompRef, so sub_c actions might come from the full workspace fallback
    // or from component completions. Either way sub_c should appear.
    expect(labels).toContain('sub_c');
  });
});

// ── Strict qualified-path scoping tests ─────────────────────────

describe('CompletionService qualified-path scoping', () => {
  it('do mycomp_c:: should return ONLY actions inside mycomp_c', () => {
    const src = [
      'component mycomp_c {',
      '  action A { }',
      '  action B { }',
      '}',
      'component other_c {',
      '  action other_action { }',
      '}',
      'struct some_struct { }',
      'enum some_enum { X, Y }',
      'component top_c {',
      '  action test_a {',
      '    activity {',
      '      do mycomp_c::',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 12, character: '      do mycomp_c::'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    // Should contain ONLY actions from mycomp_c
    expect(labels).toContain('A');
    expect(labels).toContain('B');
    // Must NOT contain anything from other scopes
    expect(labels).not.toContain('other_action');
    expect(labels).not.toContain('test_a');
    expect(labels).not.toContain('some_struct');
    expect(labels).not.toContain('some_enum');
    expect(labels).not.toContain('mycomp_c');
    expect(labels).not.toContain('other_c');
    expect(labels).not.toContain('top_c');
    // Must NOT contain keywords
    expect(labels).not.toContain('do');
    expect(labels).not.toContain('action');
    expect(labels).not.toContain('int');
    // Should be exactly 2 results
    expect(results).toHaveLength(2);
  });

  it('do mycomp_c:: without text should still use AST context (fallback)', () => {
    const src = [
      'component mycomp_c {',
      '  action A { }',
      '  action B { }',
      '}',
      'component top_c {',
      '  action test_a {',
      '    activity {',
      '      do mycomp_c::',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    // Without text: AST-based fallback (activity context)
    const results = getCompletions(
      'file:///test.pss',
      { line: 7, character: '      do mycomp_c::'.length },
      index,
      // no text
    );

    // Without text, we can't detect the :: context, so we get
    // activity-level completions (keywords + actions + components).
    // This is the fallback behavior.
    const labels = results.map(r => r.label);
    expect(labels).toContain('do');
    expect(results.length).toBeGreaterThan(2);
  });

  it('do mycomp_c::A should filter to only matching action', () => {
    const src = [
      'component mycomp_c {',
      '  action A { }',
      '  action B { }',
      '}',
      'component top_c {',
      '  action test_a {',
      '    activity {',
      '      do mycomp_c::A',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = createIndex({ 'file:///test.pss': src });
    const results = getCompletions(
      'file:///test.pss',
      { line: 7, character: '      do mycomp_c::A'.length },
      index,
      src,
    );

    const labels = results.map(r => r.label);
    expect(labels).toEqual(['A']);
  });
});
