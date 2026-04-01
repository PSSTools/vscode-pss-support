import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';

describe('diagnostic suggestions', () => {
  it('should suggest similar type for a typo in field declaration', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///types.pss', 'struct my_data_s { }');
    index.addFile('file:///test.pss', [
      'component c {',
      '  action a {',
      '    my_dta_s field;',   // typo: my_dta_s -> my_data_s
      '  }',
      '}',
    ].join('\n'));

    const diags = index.getDiagnostics('file:///test.pss');
    expect(diags.length).toBeGreaterThan(0);
    const typo = diags.find(d => d.message.includes("'my_dta_s'"));
    expect(typo).toBeDefined();
    expect(typo!.message).toContain("Did you mean 'my_data_s'");
  });

  it('should suggest similar type for misspelled component', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///comp.pss', 'component mycomp_c { }');
    index.addFile('file:///top.pss', [
      'component top {',
      '  mycomp field;',    // missing _c suffix
      '}',
    ].join('\n'));

    const diags = index.getDiagnostics('file:///top.pss');
    const d = diags.find(d => d.message.includes("'mycomp'"));
    expect(d).toBeDefined();
    expect(d!.message).toContain("Did you mean 'mycomp_c'");
  });

  it('should suggest similar type for misspelled base type', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', [
      'struct base_s { }',
      'struct child_s : base_z { }',  // typo: base_z -> base_s
    ].join('\n'));

    const diags = index.getDiagnostics('file:///test.pss');
    const d = diags.find(d => d.code === 'unresolved-base-type');
    expect(d).toBeDefined();
    expect(d!.message).toContain("Did you mean 'base_s'");
  });

  it('should not suggest when nothing is close', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', [
      'component c {',
      '  action a {',
      '    zzzzzzzzz field;',
      '  }',
      '}',
    ].join('\n'));

    const diags = index.getDiagnostics('file:///test.pss');
    const d = diags.find(d => d.message.includes("'zzzzzzzzz'"));
    expect(d).toBeDefined();
    expect(d!.message).not.toContain('Did you mean');
  });

  it('should suggest for extend target typo', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///comp.pss', 'component mycomp_c { }');
    index.addFile('file:///ext.pss', [
      'extend component mycomp_d {',   // typo: _d -> _c
      '  action new_a { }',
      '}',
    ].join('\n'));

    const diags = index.getDiagnostics('file:///ext.pss');
    const d = diags.find(d => d.code === 'unresolved-extend-target');
    expect(d).toBeDefined();
    expect(d!.message).toContain("Did you mean 'mycomp_c'");
  });

  it('should handle case-insensitive matching', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', [
      'struct MyStruct { }',
      'component c {',
      '  action a {',
      '    mystruct field;',   // wrong case
      '  }',
      '}',
    ].join('\n'));

    const diags = index.getDiagnostics('file:///test.pss');
    const d = diags.find(d => d.message.includes("'mystruct'"));
    expect(d).toBeDefined();
    expect(d!.message).toContain("Did you mean 'MyStruct'");
  });
});
