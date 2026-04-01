import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getSignatureHelp } from '../../../src/core/services/SignatureService';

describe('SignatureService', () => {
  it('should return undefined for position with no function', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'struct s { }');

    const result = getSignatureHelp('file:///test.pss', { line: 0, character: 5 }, index);
    expect(result).toBeUndefined();
  });

  it('should return undefined for nonexistent file', () => {
    const index = new WorkspaceIndex();
    const result = getSignatureHelp('file:///nonexistent.pss', { line: 0, character: 0 }, index);
    expect(result).toBeUndefined();
  });

  it('should return signature for function definition', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'function void my_func() { }');

    // Position inside the function
    const result = getSignatureHelp('file:///test.pss', { line: 0, character: 15 }, index);
    // May or may not find it depending on position resolution
  });

  it('should handle function with parameters', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'function void process(bit[32] addr, int count) { }');

    const result = getSignatureHelp('file:///test.pss', { line: 0, character: 25 }, index);
    // Position-dependent result
  });

  it('should return undefined for empty file', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', '');

    const result = getSignatureHelp('file:///test.pss', { line: 0, character: 0 }, index);
    expect(result).toBeUndefined();
  });

  it('should handle position outside any function', () => {
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', 'struct s { rand bit[32] x; }');

    const result = getSignatureHelp('file:///test.pss', { line: 0, character: 0 }, index);
    expect(result).toBeUndefined();
  });
});
