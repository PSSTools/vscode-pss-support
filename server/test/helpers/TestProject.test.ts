import { describe, it, expect } from 'vitest';
import { TestProject, applyTextEdits } from './TestProject.js';

describe('TestProject.fromFiles', () => {
  it('indexes every file and strips markers before parsing', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package pkg { struct /*[def:s]*/s { } }',
      'top.pss': 'component top { }',
    });

    expect(p.fileNames().sort()).toEqual(['pkg.pss', 'top.pss']);
    expect(p.text('pkg.pss')).toBe('package pkg { struct s { } }');
    expect(p.ast('top.pss')).toBeDefined();
  });

  it('exposes marker positions by label or bare name', () => {
    const p = TestProject.fromFiles({
      'a.pss': 'component /*[def:c]*/c { }',
    });
    expect(p.position('a.pss', 'def:c')).toEqual({ line: 0, character: 10 });
    expect(p.position('a.pss', 'c')).toEqual({ line: 0, character: 10 });
    expect(p.position('a.pss')).toEqual({ line: 0, character: 10 });
  });

  it('reports available markers when one is missing', () => {
    const p = TestProject.fromFiles({ 'a.pss': 'component /*[def:c]*/c { }' });
    expect(() => p.position('a.pss', 'nope')).toThrow(/Available: def:c/);
  });

  it('resolves types across files', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package p { struct s { } }',
      'top.pss': 'component top { p::s x; }',
    });
    expect(p.diagnostics('top.pss').filter(d => d.code === 'undefined-type')).toHaveLength(0);
  });

  it('flags genuinely undefined types', () => {
    const p = TestProject.fromFiles({
      'top.pss': 'component top { does_not_exist x; }',
    });
    expect(p.diagnostics('top.pss').some(d => d.code === 'undefined-type')).toBe(true);
  });
});

describe('TestProject.loaded', () => {
  it('discovers files through the real WorkspaceLoader', async () => {
    const p = await TestProject.loaded({
      'pkg/types.pss': 'package p { struct s { } }',
      'top.pss': 'component top { p::s x; }',
    });

    expect(p.index.getFileUris()).toHaveLength(2);
    p.assertNoErrors();
  });
});

describe('TestProject.fromFixture', () => {
  it('loads a fixture directory off disk', () => {
    const p = TestProject.fromFixture('cross-package');
    expect(p.fileNames().sort()).toEqual(['dev_comp.pss', 'pss_top.pss', 'types_pkg.pss']);
  });

  it('resolves every ref: marker to its def: marker', () => {
    // This single assertion covers cross-file go-to-definition for the whole
    // fixture: struct, enum, component, action, and a struct field.
    TestProject.fromFixture('cross-package').assertGotoResolves();
  });

  it('analyzes the fixture without errors', () => {
    TestProject.fromFixture('cross-package').assertNoErrors();
  });

  it('records field-reference navigation as a known gap', () => {
    TestProject.fromFixture('cross-package').assertKnownGaps();
  });

  it('navigates into actions added by extend blocks in other files', () => {
    const p = TestProject.fromFixture('component-extension');
    p.assertGotoResolves();
    p.assertKnownGaps();
    p.assertNoErrors();
  });

  it('throws a useful error for a missing fixture', () => {
    expect(() => TestProject.fromFixture('no-such-fixture')).toThrow(/Fixture not found/);
  });
});

describe('TestProject.edit', () => {
  it('re-indexes after an edit', () => {
    const p = TestProject.fromFiles({ 'a.pss': 'component c { }' });
    p.edit('a.pss', 'component c { unknown_t x; }');
    expect(p.diagnostics('a.pss').some(d => d.code === 'undefined-type')).toBe(true);
  });

  it('propagates an edit to dependent files', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package p { struct s { } }',
      'top.pss': 'component top { p::s x; }',
    });
    expect(p.diagnostics('top.pss').some(d => d.code === 'undefined-type')).toBe(false);

    p.edit('pkg.pss', 'package p { }');

    expect(p.diagnostics('top.pss').some(d => d.code === 'undefined-type')).toBe(true);
  });
});

describe('applyTextEdits', () => {
  it('applies a single replacement', () => {
    const text = 'component old_name { }';
    const out = applyTextEdits(text, [{
      range: { start: { line: 0, character: 10 }, end: { line: 0, character: 18 } },
      newText: 'new_name',
    }]);
    expect(out).toBe('component new_name { }');
  });

  it('applies multiple edits without invalidating earlier offsets', () => {
    const text = 'a\nb\nc';
    const out = applyTextEdits(text, [
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: 'X' },
      { range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } }, newText: 'Z' },
    ]);
    expect(out).toBe('X\nb\nZ');
  });

  it('handles insertions (empty range)', () => {
    const out = applyTextEdits('ac', [{
      range: { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } },
      newText: 'b',
    }]);
    expect(out).toBe('abc');
  });
});
