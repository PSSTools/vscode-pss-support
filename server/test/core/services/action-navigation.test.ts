import { describe, it, expect } from 'vitest';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex';
import { getDefinition } from '../../../src/core/services/DefinitionService';
import { getHover } from '../../../src/core/services/HoverService';

/**
 * Tests for navigating to action definitions from `do` traversals,
 * including cross-file and package-scoped scenarios.
 */
describe('action navigation', () => {
  describe('go-to-definition on do traversal', () => {
    it('should navigate to action defined in same file', () => {
      const src = [
        'component c {',                          // 0
        '  action target_a { }',                   // 1
        '  action caller_a {',                     // 2
        '    activity {',                          // 3
        '      do target_a;',                      // 4
        '    }',                                   // 5
        '  }',                                     // 6
        '}',                                       // 7
      ].join('\n');
      const index = new WorkspaceIndex();
      index.addFile('file:///test.pss', src);

      // "      do target_a;" -- "target_a" starts at col 9
      const defs = getDefinition('file:///test.pss', { line: 4, character: 12 }, index);
      expect(defs).toHaveLength(1);
      expect(defs[0].uri).toBe('file:///test.pss');
      expect(defs[0].range.start.line).toBe(1);
    });

    it('should navigate to action in qualified do comp::action', () => {
      const src = [
        'component iommu_c {',                    // 0
        '  action completion_wait_a { }',          // 1
        '}',                                       // 2
        'component top_c {',                       // 3
        '  iommu_c inst;',                         // 4
        '  action test_a {',                       // 5
        '    activity {',                          // 6
        '      do iommu_c::completion_wait_a;',    // 7
        '    }',                                   // 8
        '  }',                                     // 9
        '}',                                       // 10
      ].join('\n');
      const index = new WorkspaceIndex();
      index.addFile('file:///test.pss', src);

      // cursor on "completion_wait_a" part (col 22+)
      const defs = getDefinition('file:///test.pss', { line: 7, character: 24 }, index);
      expect(defs).toHaveLength(1);
      expect(defs[0].range.start.line).toBe(1);
    });

    it('should navigate to component in qualified do comp::action', () => {
      const src = [
        'component iommu_c {',                    // 0
        '  action completion_wait_a { }',          // 1
        '}',                                       // 2
        'component top_c {',                       // 3
        '  action test_a {',                       // 4
        '    activity {',                          // 5
        '      do iommu_c::completion_wait_a;',    // 6
        '    }',                                   // 7
        '  }',                                     // 8
        '}',                                       // 9
      ].join('\n');
      const index = new WorkspaceIndex();
      index.addFile('file:///test.pss', src);

      // cursor on "iommu_c" part (col 9-16)
      const defs = getDefinition('file:///test.pss', { line: 6, character: 12 }, index);
      expect(defs).toHaveLength(1);
      expect(defs[0].range.start.line).toBe(0); // component declaration
    });

    it('should navigate cross-file to action added via extend', () => {
      const index = new WorkspaceIndex();
      index.addFile('file:///iommu_c.pss', [
        'component iommu_c { }',
      ].join('\n'));
      index.addFile('file:///actions.pss', [
        'extend component iommu_c {',
        '  action completion_wait_a { }',
        '}',
      ].join('\n'));
      index.addFile('file:///scenario.pss', [
        'component test_c {',                     // 0
        '  iommu_c inst;',                        // 1
        '  action test_a {',                      // 2
        '    activity {',                          // 3
        '      do iommu_c::completion_wait_a;',   // 4
        '    }',                                  // 5
        '  }',                                    // 6
        '}',                                      // 7
      ].join('\n'));

      const defs = getDefinition('file:///scenario.pss', { line: 4, character: 24 }, index);
      expect(defs).toHaveLength(1);
      expect(defs[0].uri).toBe('file:///actions.pss');
      expect(defs[0].range.start.line).toBe(1);
    });

    it('should navigate in package-scoped project', () => {
      const index = new WorkspaceIndex();
      index.addFile('file:///iommu.pss', [
        'package iommu_pkg {',
        '  component iommu_c {',
        '    action completion_wait_a { }',
        '  }',
        '}',
      ].join('\n'));
      index.addFile('file:///scenario.pss', [
        'package scenario_pkg {',
        '  import iommu_pkg::*;',
        '  component test_c {',
        '    iommu_c inst;',
        '    action test_a {',
        '      activity {',
        '        do iommu_c::completion_wait_a;',  // line 6
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n'));

      // "        do iommu_c::completion_wait_a" -- completion_wait_a at col 22
      const defs = getDefinition('file:///scenario.pss', { line: 6, character: 26 }, index);
      expect(defs).toHaveLength(1);
      expect(defs[0].uri).toBe('file:///iommu.pss');
    });
  });

  describe('hover on do traversal', () => {
    it('should show action signature on hover', () => {
      const src = [
        'component c {',
        '  action target_a { }',
        '  action caller_a {',
        '    activity {',
        '      do target_a;',
        '    }',
        '  }',
        '}',
      ].join('\n');
      const index = new WorkspaceIndex();
      index.addFile('file:///test.pss', src);

      const hover = getHover('file:///test.pss', { line: 4, character: 12 }, index);
      expect(hover).toBeDefined();
      expect(hover!.contents).toContain('action target_a');
    });

    it('hover range should point to the reference site, not the declaration', () => {
      const index = new WorkspaceIndex();
      index.addFile('file:///a.pss', [
        'component iommu_c {',
        '  action completion_wait_a { }',
        '}',
      ].join('\n'));
      index.addFile('file:///b.pss', [
        'component top_c {',                      // 0
        '  action test_a {',                       // 1
        '    activity {',                          // 2
        '      do iommu_c::completion_wait_a;',    // 3
        '    }',                                   // 4
        '  }',                                     // 5
        '}',                                       // 6
      ].join('\n'));

      // Hover on "completion_wait_a" at line 3
      const hover = getHover('file:///b.pss', { line: 3, character: 24 }, index);
      expect(hover).toBeDefined();
      expect(hover!.contents).toContain('action completion_wait_a');
      // The hover range must be in the current file (line 3), not the declaration file
      expect(hover!.range).toBeDefined();
      expect(hover!.range!.start.line).toBe(3);
    });

    it('should show doc comment from action declaration', () => {
      const src = [
        'component c {',
        '  /** Waits for all pending commands to complete. */',
        '  action completion_wait_a { }',
        '  action caller_a {',
        '    activity {',
        '      do completion_wait_a;',
        '    }',
        '  }',
        '}',
      ].join('\n');
      const index = new WorkspaceIndex();
      index.addFile('file:///test.pss', src);

      const hover = getHover('file:///test.pss', { line: 5, character: 14 }, index);
      expect(hover).toBeDefined();
      expect(hover!.contents).toContain('completion_wait_a');
      expect(hover!.contents).toContain('Waits for all pending commands');
    });
  });
});
