import { SourcePosition } from '../../src/core/types/SourcePosition.js';
import { SourceRange } from '../../src/core/types/SourceRange.js';

export function pos(line: number, character: number): SourcePosition {
  return { line, character };
}

export function range(
  startLine: number, startChar: number,
  endLine: number, endChar: number,
): SourceRange {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}
