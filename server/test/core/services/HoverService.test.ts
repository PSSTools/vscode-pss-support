import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getHover } from '../../../src/core/services/HoverService';

function createIndex(content: string, uri: string = 'file:///test.pss'): WorkspaceIndex {
  const index = new WorkspaceIndex();
  index.addFile(uri, content);
  return index;
}

describe('HoverService', () => {
  it('should return hover for component declaration', () => {
    const index = createIndex('component my_comp { }');
    const result = getHover('file:///test.pss', { line: 0, character: 12 }, index);

    expect(result).toBeDefined();
    expect(result!.contents).toContain('component');
    expect(result!.contents).toContain('my_comp');
  });

  it('should return hover for struct declaration', () => {
    const index = createIndex('struct my_struct { rand bit[32] val; }');
    const result = getHover('file:///test.pss', { line: 0, character: 10 }, index);

    expect(result).toBeDefined();
    expect(result!.contents).toContain('struct');
  });

  it('should return hover for action inside component', () => {
    const src = 'component c {\n  action my_action { }\n}';
    const index = createIndex(src);
    const result = getHover('file:///test.pss', { line: 1, character: 12 }, index);

    expect(result).toBeDefined();
    if (result) {
      expect(result.contents).toContain('action');
      expect(result.contents).toContain('my_action');
    }
  });

  it('should return hover for field', () => {
    const src = 'struct s {\n  rand bit[32] addr;\n}';
    const index = createIndex(src);
    const result = getHover('file:///test.pss', { line: 1, character: 16 }, index);

    expect(result).toBeDefined();
    if (result) {
      expect(result.contents).toContain('addr');
    }
  });

  it('should return hover with doc comment', () => {
    const src = '/** This is my component */\ncomponent documented_comp { }';
    const index = createIndex(src);
    const result = getHover('file:///test.pss', { line: 1, character: 12 }, index);

    expect(result).toBeDefined();
    if (result) {
      expect(result.contents).toContain('documented_comp');
    }
  });

  it('should return hover for enum declaration', () => {
    const index = createIndex('enum dir_e { READ, WRITE }');
    const result = getHover('file:///test.pss', { line: 0, character: 8 }, index);

    expect(result).toBeDefined();
    if (result) {
      expect(result.contents).toContain('enum');
    }
  });

  it('should return hover for abstract action', () => {
    const index = createIndex('abstract action base_a { }');
    const result = getHover('file:///test.pss', { line: 0, character: 18 }, index);

    expect(result).toBeDefined();
    if (result) {
      expect(result.contents).toContain('abstract');
    }
  });

  it('should return hover for action with super type', () => {
    const src = 'component c {\n  action base { }\n  action child : base { }\n}';
    const index = createIndex(src);
    const result = getHover('file:///test.pss', { line: 2, character: 12 }, index);

    expect(result).toBeDefined();
    if (result) {
      expect(result.contents).toContain('child');
    }
  });

  it('should return undefined for nonexistent file', () => {
    const index = new WorkspaceIndex();
    const result = getHover('file:///nonexistent.pss', { line: 0, character: 0 }, index);
    expect(result).toBeUndefined();
  });

  it('should return hover for package declaration', () => {
    const index = createIndex('package my_pkg { }');
    const result = getHover('file:///test.pss', { line: 0, character: 10 }, index);

    expect(result).toBeDefined();
    if (result) {
      expect(result.contents).toContain('package');
    }
  });
});

function createMultiFileIndex(files: Record<string, string>): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, content] of Object.entries(files)) {
    index.addFile(uri, content);
  }
  return index;
}

describe('HoverService - type reference resolution', () => {
  const compFile = 'file:///mycomp_c.pss';
  const extAFile = 'file:///mycomp_c/A.pss';
  const topFile  = 'file:///pss_top.pss';

  function buildProjectIndex(): WorkspaceIndex {
    return createMultiFileIndex({
      [compFile]:
        '/** mycomp_c is a special IP */\n' +
        'component mycomp_c {\n' +
        '    int a;\n' +
        '}\n',
      [extAFile]:
        '/** Action A does work */\n' +
        'extend component mycomp_c {\n' +
        '    action A {\n' +
        '    }\n' +
        '}\n',
      [topFile]:
        'component pss_top {\n' +
        '    mycomp_c    c1;\n' +
        '    action Entry {\n' +
        '        activity {\n' +
        '            do mycomp_c::A;\n' +
        '        }\n' +
        '    }\n' +
        '}\n',
    });
  }

  it('should show component doc comment when hovering on type in field decl', () => {
    const index = buildProjectIndex();
    // line 1: "    mycomp_c    c1;"  — cursor on 'mycomp_c' at col 4
    const result = getHover(topFile, { line: 1, character: 4 }, index);

    expect(result).toBeDefined();
    expect(result!.contents).toContain('component mycomp_c');
    expect(result!.contents).toContain('mycomp_c is a special IP');
  });

  it('should show component doc comment when hovering on mycomp_c in traversal', () => {
    const index = buildProjectIndex();
    // line 4: "            do mycomp_c::A;"  — cursor on 'mycomp_c' at col 15
    const result = getHover(topFile, { line: 4, character: 15 }, index);

    expect(result).toBeDefined();
    expect(result!.contents).toContain('component mycomp_c');
    expect(result!.contents).toContain('mycomp_c is a special IP');
  });

  it('should show action info when hovering on A in traversal', () => {
    const index = buildProjectIndex();
    // line 4: "            do mycomp_c::A;"  — cursor on 'A' at col 25
    const result = getHover(topFile, { line: 4, character: 25 }, index);

    expect(result).toBeDefined();
    expect(result!.contents).toContain('action A');
  });

  it('should show component signature for single-file extend hover', () => {
    const index = createMultiFileIndex({
      'file:///all.pss':
        '/** My component */\n' +
        'component c {\n' +
        '    int x;\n' +
        '}\n' +
        'extend component c {\n' +
        '    action DoIt { }\n' +
        '}\n' +
        'component top {\n' +
        '    c inst;\n' +
        '    action Go {\n' +
        '        activity {\n' +
        '            do c::DoIt;\n' +
        '        }\n' +
        '    }\n' +
        '}\n',
    });

    // line 11: "            do c::DoIt;" — cursor on 'c' at col 15
    const result = getHover('file:///all.pss', { line: 11, character: 15 }, index);
    expect(result).toBeDefined();
    expect(result!.contents).toContain('component c');
    expect(result!.contents).toContain('My component');
  });
});
