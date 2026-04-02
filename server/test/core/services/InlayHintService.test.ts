import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getInlayHints } from '../../../src/core/services/InlayHintService';

function createIndex(files: Record<string, string>): WorkspaceIndex {
  const index = new WorkspaceIndex();
  for (const [uri, content] of Object.entries(files)) index.addFile(uri, content);
  return index;
}

describe('InlayHintService', () => {
  it('should return empty for empty file', () => {
    const index = createIndex({ 'file:///t.pss': '' });
    const hints = getInlayHints('file:///t.pss', { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } }, index);
    expect(hints).toHaveLength(0);
  });

  it('should return empty for nonexistent file', () => {
    const index = new WorkspaceIndex();
    const hints = getInlayHints('file:///nope.pss', { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } }, index);
    expect(hints).toHaveLength(0);
  });

  it('should return empty for file without templates', () => {
    const index = createIndex({ 'file:///t.pss': 'struct s { rand bit[32] x; }' });
    const hints = getInlayHints('file:///t.pss', { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } }, index);
    expect(hints).toHaveLength(0);
  });

  it('should handle range filtering', () => {
    const index = createIndex({ 'file:///t.pss': 'struct s1 { }\nstruct s2 { }\nstruct s3 { }' });
    const hints = getInlayHints('file:///t.pss', { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, index);
    // No hints expected for simple structs
    expect(hints).toHaveLength(0);
  });
});
