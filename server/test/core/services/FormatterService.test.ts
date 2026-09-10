import { describe, it, expect } from 'vitest';
import { parseSource } from '../../helpers/ParseHelper.js';
import { formatDocument } from '../../../src/core/services/FormatterService.js';

function format(source: string): string {
  const ast = parseSource(source)!;
  const edits = formatDocument(source, ast);
  if (edits.length === 0) return source;
  return edits[0].newText;
}

describe('FormatterService', () => {
  it('should format a struct with proper indentation', () => {
    const result = format('struct s { rand bit[32] x; }');
    expect(result).toContain('struct s {');
    expect(result).toContain('    rand');
  });

  it('should format empty struct', () => {
    const result = format('struct s { }');
    expect(result).toContain('struct s');
  });

  it('should format package with contents', () => {
    const result = format('package p { struct s { } }');
    expect(result).toContain('package p {');
    expect(result).toContain('    struct s');
  });

  it('should format enum with items', () => {
    const result = format('enum e { A, B, C }');
    expect(result).toContain('enum e {');
  });

  it('should insert final newline', () => {
    const result = format('struct s { }');
    expect(result.endsWith('\n')).toBe(true);
  });

  it('should format component with actions', () => {
    const result = format('component c { action a { rand bit[32] x; } }');
    expect(result).toContain('component c {');
  });

  it('should return empty edits for empty source', () => {
    const ast = parseSource('')!;
    const edits = formatDocument('', ast);
    expect(edits).toHaveLength(0);
  });

  it('should handle import statements', () => {
    const result = format('package p { import a::*; }');
    expect(result).toContain('import a::*;');
  });
});
