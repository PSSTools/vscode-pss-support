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
   * Finding: the "suggest import" quick fix is unreachable in production.
   *
   * It triggers only on an `undefined-type` diagnostic and then looks for a
   * package that declares the type. But the analyzer resolves unqualified
   * cross-package references without requiring an import, so `undefined-type`
   * is raised only for types that exist in no package at all -- exactly the
   * case where there is nothing to import.
   *
   * The pre-existing CodeActionService test could not see this because it
   * fabricated the diagnostic by hand instead of getting one from the analyzer.
   *
   * These two tests pin both halves of the contradiction. Resolving it means
   * deciding whether the analyzer should require imports (making the fix live)
   * or whether the quick fix should be removed.
   */
  it('does not diagnose a cross-package type used without an import', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package my_pkg {\n    struct target_s { }\n}',
      'top.pss': 'component top {\n    target_s x;\n}',
    });

    expect(
      p.diagnostics('top.pss').filter(d => d.code === 'undefined-type'),
      'analyzer now requires imports -- the import quick fix may be reachable; ' +
      'give it a round-trip test',
    ).toHaveLength(0);
  });

  it('offers no import fix, because nothing is diagnosed to fix', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package my_pkg {\n    struct target_s { }\n}',
      'top.pss': 'component top {\n    target_s x;\n}',
    });
    expect(p.codeActionsAt('top.pss')).toEqual([]);
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
