/**
 * These parse real source rather than hand-building nodes.
 *
 * They used to construct the tree directly, and every one of them passed for
 * as long as it took the AST schema to move underneath them: the classes they
 * named (`MonitorActivityActionTraversal`) stopped existing, and `overlap`
 * stopped being a binary node with `lhs`/`rhs`. A hand-built tree cannot
 * notice that -- it asserts the builder handles a shape the parser no longer
 * produces. Parsing is slower and worth it.
 */
import { describe, it, expect } from 'vitest';
import { MonitorDiagramBuilder } from '../../../src/core/diagram/MonitorDiagramBuilder.js';
import { MonitorActivityDecl } from '../../../src/core/ast/generated/index.js';
import { parseSource } from '../../helpers/ParseHelper.js';
import { walkScope } from '../../../src/core/ast/ASTUtils.js';
import { DiagramNodeKind } from '../../../src/core/types/DiagramNode.js';
import { DiagramEdgeStyle } from '../../../src/core/types/DiagramEdge.js';

/** The monitor activity declared by `body`, inside a component with two handles. */
function monitorActivity(body: string): MonitorActivityDecl {
  const gs = parseSource([
    'component c {',
    '  action a { }',
    '  monitor m {',
    '    a h1;',
    '    a h2;',
    '    activity {',
    body,
    '    }',
    '  }',
    '}',
  ].join('\n'))!;

  for (const node of walkScope(gs)) {
    if (node instanceof MonitorActivityDecl) return node;
  }
  throw new Error('no MonitorActivityDecl in tree');
}

function graphFor(body: string) {
  return new MonitorDiagramBuilder().build(monitorActivity(body));
}

describe('MonitorDiagramBuilder', () => {
  it('should produce start and end for empty monitor', () => {
    const graph = graphFor('');
    expect(graph.nodes.find(n => n.kind === DiagramNodeKind.Start)).toBeDefined();
    expect(graph.nodes.find(n => n.kind === DiagramNodeKind.End)).toBeDefined();
  });

  it('should produce dashed edge for eventually', () => {
    const graph = graphFor('      eventually h1;');
    const dashed = graph.edges.filter(e => e.style === DiagramEdgeStyle.Dashed);
    expect(dashed.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce fork/join for overlap', () => {
    const graph = graphFor('      overlap { h1; h2; }');
    expect(graph.nodes.filter(n => n.kind === DiagramNodeKind.Fork).length).toBeGreaterThanOrEqual(1);
    expect(graph.nodes.filter(n => n.kind === DiagramNodeKind.Join).length).toBeGreaterThanOrEqual(1);
  });

  it('should produce labeled edge for concat', () => {
    const graph = graphFor('      concat { h1; h2; }');
    expect(graph.edges.filter(e => e.label === '##').length).toBeGreaterThanOrEqual(1);
  });

  it('chains all three operands of a three-way concat', () => {
    // The n-ary case, which a binary reading of concat drops silently.
    const graph = graphFor('      concat { h1; h2; h1; }');
    expect(graph.edges.filter(e => e.label === '##')).toHaveLength(2);
  });

  it('should serialize to JSON', () => {
    expect(JSON.stringify(graphFor('').toJSON())).toBeDefined();
  });

  it('should handle action traversal node', () => {
    const graph = graphFor('      h1;');
    expect(graph.nodes.filter(n => n.kind === DiagramNodeKind.Action).length)
      .toBeGreaterThanOrEqual(1);
  });
});
