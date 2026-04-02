import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getHover } from '../../../src/core/services/HoverService';

describe('hover doc-comment rendering', () => {
  it('should render multi-line /** */ comment as clean markdown', () => {
    const src = [
      'component c {',
      '  /**',
      '   * Waits for all pending commands.',
      '   * Must be called after invalidation.',
      '   */',
      '  action completion_wait_a { }',
      '}',
    ].join('\n');
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', src);

    const hover = getHover('file:///test.pss', { line: 5, character: 10 }, index);
    expect(hover).toBeDefined();
    expect(hover!.contents).toContain('Waits for all pending commands.');
    expect(hover!.contents).toContain('Must be called after invalidation.');
    // Should NOT contain raw * prefixes
    expect(hover!.contents).not.toMatch(/^\s*\*/m);
  });

  it('should render single-line // comment', () => {
    const src = [
      'component c {',
      '  // Performs a DMA read operation',
      '  action dma_read_a { }',
      '}',
    ].join('\n');
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', src);

    const hover = getHover('file:///test.pss', { line: 2, character: 10 }, index);
    expect(hover).toBeDefined();
    expect(hover!.contents).toContain('Performs a DMA read operation');
  });

  it('should preserve markdown structure in javadoc comments', () => {
    const src = [
      '/**',
      ' * A struct for address data.',
      ' *',
      ' * Fields:',
      ' *  - addr: base address',
      ' *  - size: transfer size',
      ' */',
      'struct addr_s {',
      '  rand bit[64] addr;',
      '}',
    ].join('\n');
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', src);

    const hover = getHover('file:///test.pss', { line: 7, character: 8 }, index);
    expect(hover).toBeDefined();
    expect(hover!.contents).toContain('A struct for address data.');
    expect(hover!.contents).toContain('Fields:');
    expect(hover!.contents).toContain('- addr: base address');
    expect(hover!.contents).toContain('- size: transfer size');
  });

  it('should handle /** single-line */ comment', () => {
    const src = [
      '/** Brief description */',
      'struct s { }',
    ].join('\n');
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', src);

    const hover = getHover('file:///test.pss', { line: 1, character: 5 }, index);
    expect(hover).toBeDefined();
    expect(hover!.contents).toContain('Brief description');
  });

  it('should show doc comment when hovering on do traversal target', () => {
    const src = [
      'component c {',
      '  /**',
      '   * Completes the transaction.',
      '   */',
      '  action finish_a { }',
      '  action runner_a {',
      '    activity {',
      '      do finish_a;',
      '    }',
      '  }',
      '}',
    ].join('\n');
    const index = new WorkspaceIndex();
    index.addFile('file:///test.pss', src);

    const hover = getHover('file:///test.pss', { line: 7, character: 12 }, index);
    expect(hover).toBeDefined();
    expect(hover!.contents).toContain('action finish_a');
    expect(hover!.contents).toContain('Completes the transaction.');
  });
});
