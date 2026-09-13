import { describe, it, expect } from 'vitest';
import { TestProject } from '../../helpers/TestProject.js';

/**
 * Apply-then-reparse tests.
 *
 * Producing an edit is not the same as producing a *correct* edit, and until
 * now nothing checked the difference: every rename and code-action test
 * asserted on the shape of the edit object and stopped there. These tests apply
 * the edits to the project and re-analyze, which is what the user experiences.
 */

describe('rename round-trip', () => {
  it('renames a type and every reference to it, across files', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package p {\n    struct /*[decl]*/old_s { }\n}',
      'top.pss': 'import p::*;\ncomponent top {\n    old_s a;\n    old_s b;\n}',
    });

    const result = p.renameAt('pkg.pss', 'new_s', 'decl');
    p.applyEdits(result.edits);

    expect(p.text('pkg.pss')).toContain('struct new_s');
    expect(p.text('pkg.pss')).not.toContain('old_s');
    expect(p.text('top.pss')).not.toContain('old_s');
    expect(p.text('top.pss').match(/new_s/g) ?? []).toHaveLength(2);
  });

  it('leaves the project analyzing cleanly after a rename', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package p {\n    struct /*[decl]*/old_s { }\n}',
      'top.pss': 'import p::*;\ncomponent top {\n    old_s a;\n}',
    });
    p.assertNoErrors();

    p.applyEdits(p.renameAt('pkg.pss', 'new_s', 'decl').edits);

    // The real assertion: the renamed project still resolves. A rename that
    // updates the declaration but misses a reference fails here, not earlier.
    p.assertNoErrors();
  });

  it('renames a component and keeps its field declarations resolving', () => {
    const p = TestProject.fromFiles({
      'base.pss': 'component /*[decl]*/my_comp { }',
      'top.pss': 'component top {\n    my_comp inst;\n}',
    });

    p.applyEdits(p.renameAt('base.pss', 'renamed_comp', 'decl').edits);

    expect(p.text('top.pss')).toContain('renamed_comp inst;');
    p.assertNoErrors();
  });

  it('is reversible', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package p {\n    struct /*[decl]*/old_s { }\n}',
      'top.pss': 'import p::*;\ncomponent top {\n    old_s a;\n}',
    });
    const original = { pkg: p.text('pkg.pss'), top: p.text('top.pss') };

    p.applyEdits(p.renameAt('pkg.pss', 'temp_s', 'decl').edits);
    // Re-locate the declaration in the edited text before renaming back.
    p.edit('pkg.pss', 'package p {\n    struct /*[decl]*/temp_s { }\n}');
    p.applyEdits(p.renameAt('pkg.pss', 'old_s', 'decl').edits);

    expect(p.text('pkg.pss')).toBe(original.pkg);
    expect(p.text('top.pss')).toBe(original.top);
  });
});

describe('code action round-trip', () => {
  /**
   * The "suggest import" quick fix is reachable, and these pin the loop.
   *
   * It was not, under the old analyzer: that resolved unqualified
   * cross-package references without requiring an import, so `undefined-type`
   * was raised only for types that existed in no package at all -- exactly
   * the case where there is nothing to import. The parser's linker follows
   * the LRM and requires the import, which puts the diagnostic and the fix
   * back in the same place.
   *
   * The CodeActionService unit test cannot see any of this: it fabricates the
   * diagnostic by hand rather than getting one from the analyzer, so it would
   * have passed either way.
   */
  it('diagnoses a cross-package type used without an import', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package my_pkg {\n    struct target_s { }\n}',
      'top.pss': 'component top {\n    target_s x;\n}',
    });

    expect(p.diagnostics('top.pss').filter(d => d.code === 'undefined-type')).toHaveLength(1);
  });

  it('offers an import fix whose edit makes the diagnostic go away', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package my_pkg {\n    struct target_s { }\n}',
      'top.pss': 'component top {\n    target_s x;\n}',
    });

    const fixes = p.codeActionsAt('top.pss')
      .filter(a => a.title.toLowerCase().includes('import'));
    expect(fixes).toHaveLength(1);

    p.applyEdits(fixes[0].edits);

    // The round trip: the fix the server offered has to actually fix it.
    expect(p.text('top.pss')).toContain('import my_pkg::target_s;');
    expect(p.diagnostics('top.pss').filter(d => d.code === 'undefined-type')).toHaveLength(0);
  });

  it('offers no import fix for a type that exists nowhere', () => {
    const p = TestProject.fromFiles({
      'top.pss': 'component top {\n    nowhere_s x;\n}',
    });

    expect(p.diagnostics('top.pss').some(d => d.code === 'undefined-type')).toBe(true);
    // There is no package declaring `nowhere_s`, so no import can be suggested.
    const imports = p.codeActionsAt('top.pss').filter(a => a.title.toLowerCase().includes('import'));
    expect(imports).toEqual([]);
  });

  it('offers no actions for a clean file', () => {
    const p = TestProject.fromFiles({ 'a.pss': 'component c { }' });
    expect(p.codeActionsAt('a.pss')).toEqual([]);
  });
});
