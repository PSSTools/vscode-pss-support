import { describe, it, expect } from 'vitest';
import { TestProject } from '../../helpers/TestProject';
import { TOKEN_TYPES } from '../../../src/core/services/SemanticTokenService';

/**
 * Structural invariants the LSP requires of semantic tokens.
 *
 * These are not style preferences: VS Code's tokenizer assumes single-line,
 * non-overlapping tokens, and violating either produces mis-coloured or dropped
 * regions. Before these tests existed the service emitted tokens spanning whole
 * declarations -- a 208-character `namespace` token covering an entire package.
 */
describe('semantic token invariants', () => {
  const sources: Record<string, string> = {
    'types.pss': [
      'package p {',
      '    struct data_s {',
      '        rand bit[32] addr;',
      '        const bit[8] size;',
      '    }',
      '    enum mode_e { READ, WRITE }',
      '    function void helper(int arg_a, int arg_b);',
      '}',
    ].join('\n'),
    'comp.pss': [
      'component dev_c {',
      '    action write_a {',
      '        rand int x;',
      '    }',
      '}',
    ].join('\n'),
  };

  const project = () => TestProject.fromFiles(sources);

  for (const name of Object.keys(sources)) {
    describe(name, () => {
      it('every token covers only its own identifier text', () => {
        const p = project();
        const lines = p.text(name).split('\n');

        for (const token of p.semanticTokens(name)) {
          const line = lines[token.line];
          expect(line, `token on line ${token.line + 1} but file has ${lines.length} lines`)
            .toBeDefined();

          const text = line.substr(token.startChar, token.length);
          // An identifier, not a span of declaration syntax.
          expect(
            text,
            `token at ${token.line + 1}:${token.startChar + 1} covers ${JSON.stringify(text)}`,
          ).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
        }
      });

      it('no token runs past the end of its line', () => {
        const p = project();
        const lines = p.text(name).split('\n');
        for (const token of p.semanticTokens(name)) {
          expect(
            token.startChar + token.length,
            `token at ${token.line + 1}:${token.startChar + 1} overruns the line`,
          ).toBeLessThanOrEqual(lines[token.line].length);
        }
      });

      it('tokens do not overlap', () => {
        const p = project();
        const sorted = [...p.semanticTokens(name)]
          .sort((a, b) => a.line - b.line || a.startChar - b.startChar);

        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const cur = sorted[i];
          if (prev.line !== cur.line) continue;
          expect(
            cur.startChar,
            `token at ${cur.line + 1}:${cur.startChar + 1} overlaps the previous one`,
          ).toBeGreaterThanOrEqual(prev.startChar + prev.length);
        }
      });

      it('every token type is in the registered legend', () => {
        const p = project();
        for (const token of p.semanticTokens(name)) {
          expect(TOKEN_TYPES[token.tokenType], `unknown token type ${token.tokenType}`)
            .toBeDefined();
        }
      });
    });
  }

  it('colours declaration names, not declaration keywords', () => {
    const p = TestProject.fromFiles({ 'a.pss': 'component dev_c { }' });
    const tokens = p.semanticTokens('a.pss');

    expect(tokens).toHaveLength(1);
    // 'component' starts at 0; the name starts at 10.
    expect(tokens[0].startChar).toBe(10);
    expect(tokens[0].length).toBe('dev_c'.length);
  });

  it('emits one token per segment of a qualified package name', () => {
    const p = TestProject.fromFiles({ 'a.pss': 'package outer::inner { }' });
    const tokens = p.semanticTokens('a.pss');

    const text = p.text('a.pss');
    expect(tokens.map(t => text.substr(t.startChar, t.length))).toEqual(['outer', 'inner']);
  });
});
