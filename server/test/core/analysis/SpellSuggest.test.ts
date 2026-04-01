import { describe, it, expect } from 'vitest';
import { levenshtein, findBestMatch } from '../../../src/core/analysis/SpellSuggest';

describe('levenshtein', () => {
  it('identical strings -> 0', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('empty vs non-empty -> length', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('single substitution -> 1', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });

  it('single insertion -> 1', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
  });

  it('single deletion -> 1', () => {
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('transposition -> 2', () => {
    expect(levenshtein('ab', 'ba')).toBe(2);
  });

  it('completely different -> max length', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });
});

describe('findBestMatch', () => {
  const candidates = [
    'mycomp_c', 'other_comp', 'my_action', 'data_struct',
    'pss_top', 'read_action', 'write_action',
  ];

  it('should find exact match', () => {
    expect(findBestMatch('mycomp_c', candidates)).toBe('mycomp_c');
  });

  it('should find close match with typo', () => {
    expect(findBestMatch('mycomp_', candidates)).toBe('mycomp_c');
  });

  it('should find match with case difference', () => {
    expect(findBestMatch('MyComp_C', candidates)).toBe('mycomp_c');
  });

  it('should find match with letter swap', () => {
    expect(findBestMatch('myocmp_c', candidates)).toBe('mycomp_c');
  });

  it('should return null for completely unrelated name', () => {
    expect(findBestMatch('zzzzzzz', candidates)).toBeNull();
  });

  it('should return null for empty candidates', () => {
    expect(findBestMatch('foo', [])).toBeNull();
  });

  it('should match short names within distance 2', () => {
    expect(findBestMatch('foo', ['fop', 'bar', 'baz'])).toBe('fop');
  });

  it('should not match short names beyond distance 2', () => {
    expect(findBestMatch('ab', ['xyz', 'pqr'])).toBeNull();
  });
});
