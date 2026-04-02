import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getDefinition } from '../../../src/core/services/DefinitionService';

function createIndex(files: Record<string, string>): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, content] of Object.entries(files)) {
    index.addFile(uri, content);
  }
  return index;
}

describe('DefinitionService - qualified type traversal (mycomp_c::A)', () => {
  // Mirrors ../proj layout: component declared in one file, actions added
  // via extend in separate files, referenced as mycomp_c::A in an activity.
  const compFile = 'file:///mycomp_c.pss';
  const extAFile = 'file:///mycomp_c/A.pss';
  const extBFile = 'file:///mycomp_c/B.pss';
  const topFile  = 'file:///pss_top.pss';

  function buildProjectIndex(): WorkspaceIndex {
    return createIndex({
      [compFile]: 'component mycomp_c {\n    int a;\n}\n',
      [extAFile]:
        'extend component mycomp_c {\n' +
        '    action A {\n' +
        '    }\n' +
        '}\n',
      [extBFile]:
        'extend component mycomp_c {\n' +
        '    action B {\n' +
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

  it('should resolve full qualified name mycomp_c::A to action declaration', () => {
    const index = buildProjectIndex();
    // "do mycomp_c::A;" -- position on 'A' (the action part)
    //  line 4: "            do mycomp_c::A;"
    //  'A' starts at column 25
    const results = getDefinition(topFile, { line: 4, character: 25 }, index);
    expect(results.length).toBeGreaterThan(0);
    // Should point to the action A declaration in the extend file
    expect(results[0].uri).toBe(extAFile);
  });

  it('should resolve component part of mycomp_c::A to component declaration', () => {
    const index = buildProjectIndex();
    // "do mycomp_c::A;" -- position on 'mycomp_c' (the component part)
    //  line 4: "            do mycomp_c::A;"
    //  'mycomp_c' starts at column 15
    const results = getDefinition(topFile, { line: 4, character: 15 }, index);
    expect(results.length).toBeGreaterThan(0);
    // Should point to the component declaration in mycomp_c.pss
    expect(results[0].uri).toBe(compFile);
  });

  it('should resolve mycomp_c instance type to component declaration', () => {
    const index = buildProjectIndex();
    // "    mycomp_c    c1;" -- position on 'mycomp_c' (field type)
    //  line 1: "    mycomp_c    c1;"
    const results = getDefinition(topFile, { line: 1, character: 5 }, index);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].uri).toBe(compFile);
  });

  it('should handle single-file extend with action traversal', () => {
    const index = createIndex({
      'file:///all.pss':
        'component c {\n' +
        '    int x;\n' +
        '}\n' +
        'extend component c {\n' +
        '    action DoIt {\n' +
        '    }\n' +
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

    // "do c::DoIt;" on line 11, 'DoIt' starts at col 18
    const results = getDefinition('file:///all.pss', { line: 11, character: 18 }, index);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].uri).toBe('file:///all.pss');
    // Should point to the action DoIt declaration (line 4, 0-indexed)
    expect(results[0].range.start.line).toBe(4);
  });

  it('should resolve component part in single-file extend', () => {
    const index = createIndex({
      'file:///all.pss':
        'component c {\n' +
        '    int x;\n' +
        '}\n' +
        'extend component c {\n' +
        '    action DoIt {\n' +
        '    }\n' +
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

    // "do c::DoIt;" on line 11, 'c' at col 15
    const results = getDefinition('file:///all.pss', { line: 11, character: 15 }, index);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].uri).toBe('file:///all.pss');
    // Should point to the component c declaration (line 0)
    expect(results[0].range.start.line).toBe(0);
  });

  it('should handle multiple extensions on same component', () => {
    const index2 = createIndex({
      [compFile]: 'component mycomp_c {\n    int a;\n}\n',
      [extAFile]:
        'extend component mycomp_c {\n' +
        '    action A {\n' +
        '    }\n' +
        '}\n',
      [extBFile]:
        'extend component mycomp_c {\n' +
        '    action B {\n' +
        '    }\n' +
        '}\n',
      [topFile]:
        'component pss_top {\n' +
        '    mycomp_c    c1;\n' +
        '    action Entry {\n' +
        '        activity {\n' +
        '            do mycomp_c::B;\n' +
        '        }\n' +
        '    }\n' +
        '}\n',
    });

    // "do mycomp_c::B;" -- position on 'B'
    const results = getDefinition(topFile, { line: 4, character: 25 }, index2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].uri).toBe(extBFile);
  });
});
