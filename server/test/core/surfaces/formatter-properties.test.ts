import { describe, it, expect } from 'vitest';
import { TestProject } from '../../helpers/TestProject.js';
import { renderDocumentSymbols } from '../../helpers/Probes.js';

/**
 * Property tests for the formatter.
 *
 * A 341-line AST-driven formatter cannot be pinned down by a handful of
 * example goldens: the interesting failures are the ones that lose or reorder
 * code. These three properties catch that class directly --
 *
 *   1. idempotence     -- format(format(x)) == format(x)
 *   2. AST preservation -- formatting does not change what the code means
 *   3. no new errors    -- formatted output still parses cleanly
 *
 * A formatter that silently drops a member passes any golden written after the
 * bug was introduced, but fails property 2 immediately.
 */

const SAMPLES: Record<string, string> = {
  'component with actions': [
    'component dev_c {',
    '    int a;',
    '    action write_a {',
    '        rand int x;',
    '        constraint c { x > 0; }',
    '    }',
    '}',
  ].join('\n'),

  'package of types': [
    'package p {',
    '    struct data_s { rand bit[32] addr; }',
    '    enum mode_e { READ, WRITE }',
    '}',
  ].join('\n'),

  'badly indented input': 'component c {\n int a;\n      action x { }\n}',

  'already formatted input': 'component c {\n    int a;\n}\n',

  'nested activity': [
    'component top {',
    '    action Entry {',
    '        activity {',
    '            do other_a;',
    '        }',
    '    }',
    '    action other_a { }',
    '}',
  ].join('\n'),
};

describe('formatter properties', () => {
  for (const [label, source] of Object.entries(SAMPLES)) {
    describe(label, () => {
      it('is idempotent', () => {
        const p = TestProject.fromFiles({ 'a.pss': source });
        const once = p.formatted('a.pss');

        p.edit('a.pss', once);
        const twice = p.formatted('a.pss');

        expect(twice, 'formatting a formatted document changed it again').toBe(once);
      });

      it('preserves the declaration structure', () => {
        const p = TestProject.fromFiles({ 'a.pss': source });
        const before = renderDocumentSymbols(p.documentSymbols('a.pss'));

        p.edit('a.pss', p.formatted('a.pss'));
        const after = renderDocumentSymbols(p.documentSymbols('a.pss'));

        // Positions legitimately move; names, kinds and nesting must not.
        expect(stripPositions(after)).toBe(stripPositions(before));
      });

      it('introduces no diagnostics', () => {
        const p = TestProject.fromFiles({ 'a.pss': source });
        expect(p.diagnostics('a.pss'), 'sample is not clean to begin with').toEqual([]);

        p.edit('a.pss', p.formatted('a.pss'));

        expect(
          p.diagnostics('a.pss').map(d => d.message),
          'formatting introduced diagnostics',
        ).toEqual([]);
      });
    });
  }

  it('returns no edits for an already-formatted document', () => {
    const p = TestProject.fromFiles({ 'a.pss': SAMPLES['component with actions'] });
    const formatted = p.formatted('a.pss');

    p.edit('a.pss', formatted);
    expect(p.format('a.pss')).toEqual([]);
  });
});

/** Drop the `@line:col` suffixes so structure can be compared across reflows. */
function stripPositions(rendered: string): string {
  return rendered.replace(/ @\d+:\d+/g, '');
}
