import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';

/**
 * Multi-file diagnostic tests. Validates that type references across
 * files are resolved correctly and that only genuinely undefined types
 * produce diagnostics.
 *
 * Modeled after the user's project structure:
 *   mycomp_c.pss            -- defines component mycomp_c
 *   mycomp_c/A.pss          -- extends mycomp_c with action A
 *   mycomp_c/B.pss          -- extends mycomp_c with action B
 *   pss_top.pss             -- references mycomp_c and a non-existent type foo
 */
describe('multi-file diagnostics', () => {
  function buildProjectIndex(): WorkspaceIndex {
    const index = new WorkspaceIndex();
    index.addFile('file:///mycomp_c.pss', [
      'component mycomp_c {',
      '  int a;',
      '}',
    ].join('\n'));
    index.addFile('file:///mycomp_c/A.pss', [
      'extend component mycomp_c {',
      '  action A { }',
      '}',
    ].join('\n'));
    index.addFile('file:///mycomp_c/B.pss', [
      'extend component mycomp_c {',
      '  action B { }',
      '}',
    ].join('\n'));
    index.addFile('file:///pss_top.pss', [
      'component pss_top {',
      '  mycomp_c c1, c2;',
      '  foo abc;',
      '  action Entry {',
      '    activity {',
      '      do mycomp_c::A;',
      '      do mycomp_c::B;',
      '    }',
      '  }',
      '}',
    ].join('\n'));
    return index;
  }

  it('should flag undefined type foo in pss_top.pss', () => {
    const index = buildProjectIndex();
    const diags = index.getDiagnostics('file:///pss_top.pss');
    const fooDiags = diags.filter(d => d.message.includes("'foo'"));
    expect(fooDiags).toHaveLength(1);
    expect(fooDiags[0].code).toBe('undefined-type');
  });

  it('should NOT flag mycomp_c in pss_top.pss (defined in another file)', () => {
    const index = buildProjectIndex();
    const diags = index.getDiagnostics('file:///pss_top.pss');
    const mycompDiags = diags.filter(d => d.message.includes("'mycomp_c'"));
    expect(mycompDiags).toHaveLength(0);
  });

  it('should have zero diagnostics for mycomp_c.pss', () => {
    const index = buildProjectIndex();
    const diags = index.getDiagnostics('file:///mycomp_c.pss');
    expect(diags).toHaveLength(0);
  });

  it('should have zero diagnostics for extension files', () => {
    const index = buildProjectIndex();
    expect(index.getDiagnostics('file:///mycomp_c/A.pss')).toHaveLength(0);
    expect(index.getDiagnostics('file:///mycomp_c/B.pss')).toHaveLength(0);
  });

  it('should resolve cross-file type when file is added after reference', () => {
    const index = new WorkspaceIndex();
    // Add pss_top first (before mycomp_c exists)
    index.addFile('file:///pss_top.pss', [
      'component pss_top {',
      '  mycomp_c c1;',
      '}',
    ].join('\n'));

    const diagsBefore = index.getDiagnostics('file:///pss_top.pss');
    expect(diagsBefore.some(d => d.message.includes("'mycomp_c'"))).toBe(true);

    // Now add mycomp_c definition
    index.addFile('file:///mycomp_c.pss', 'component mycomp_c { }');

    // Re-check: mycomp_c should be resolved now
    const diagsAfter = index.getDiagnostics('file:///pss_top.pss');
    expect(diagsAfter.filter(d => d.message.includes("'mycomp_c'"))).toHaveLength(0);
  });

  it('should report error when referenced file is removed', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///mycomp_c.pss', 'component mycomp_c { }');
    index.addFile('file:///pss_top.pss', [
      'component pss_top {',
      '  mycomp_c c1;',
      '}',
    ].join('\n'));

    // Initially OK
    expect(index.getDiagnostics('file:///pss_top.pss')
      .filter(d => d.message.includes("'mycomp_c'"))).toHaveLength(0);

    // Remove the definition
    index.removeFile('file:///mycomp_c.pss');

    // Now mycomp_c should be undefined
    const diags = index.getDiagnostics('file:///pss_top.pss');
    expect(diags.some(d => d.message.includes("'mycomp_c'"))).toBe(true);
  });

  it('should handle struct references across files', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///types.pss', [
      'struct my_data_s {',
      '  rand int value;',
      '}',
    ].join('\n'));
    index.addFile('file:///user.pss', [
      'component c {',
      '  action a {',
      '    my_data_s data;',
      '  }',
      '}',
    ].join('\n'));

    const diags = index.getDiagnostics('file:///user.pss');
    expect(diags.filter(d => d.message.includes("'my_data_s'"))).toHaveLength(0);
  });

  it('should handle package-scoped types across files', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///pkg.pss', [
      'package my_pkg {',
      '  struct data_s { }',
      '}',
    ].join('\n'));
    index.addFile('file:///user.pss', [
      'import my_pkg::*;',
      'component c {',
      '  action a {',
      '    data_s d;',
      '  }',
      '}',
    ].join('\n'));

    const diags = index.getDiagnostics('file:///user.pss');
    // data_s should be found via the import
    const dataDiags = diags.filter(d => d.message.includes("'data_s'"));
    expect(dataDiags).toHaveLength(0);
  });

  it('should flag truly undefined types, not cross-file types', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///a.pss', [
      'struct real_type { }',
      'component comp_a { }',
    ].join('\n'));
    index.addFile('file:///b.pss', [
      'component comp_b {',
      '  real_type f1;',        // should be OK
      '  fake_type f2;',        // should be flagged
      '  comp_a   comp_ref;',   // should be OK
      '}',
    ].join('\n'));

    const diags = index.getDiagnostics('file:///b.pss');
    const messages = diags.map(d => d.message);
    expect(messages.some(m => m.includes("'fake_type'"))).toBe(true);
    expect(messages.some(m => m.includes("'real_type'"))).toBe(false);
    expect(messages.some(m => m.includes("'comp_a'"))).toBe(false);
  });
});
