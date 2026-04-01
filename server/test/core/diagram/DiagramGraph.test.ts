import { describe, it, expect } from 'vitest';
import { DiagramGraph } from '../../../src/core/diagram/DiagramGraph';
import { DiagramNodeKind } from '../../../src/core/types/DiagramNode';
import { DiagramEdgeStyle } from '../../../src/core/types/DiagramEdge';

describe('DiagramGraph', () => {
  it('should create an empty graph', () => {
    const g = new DiagramGraph();
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });

  it('should add nodes with unique IDs', () => {
    const g = new DiagramGraph();
    const n1 = g.addNode(DiagramNodeKind.Action, 'a');
    const n2 = g.addNode(DiagramNodeKind.Action, 'b');
    expect(n1.id).not.toBe(n2.id);
    expect(g.nodes).toHaveLength(2);
  });

  it('should add edges between nodes', () => {
    const g = new DiagramGraph();
    const n1 = g.addNode(DiagramNodeKind.Start);
    const n2 = g.addNode(DiagramNodeKind.End);
    const e = g.addEdge(n1.id, n2.id, 'label', DiagramEdgeStyle.Solid);
    expect(e.sourceId).toBe(n1.id);
    expect(e.targetId).toBe(n2.id);
    expect(e.label).toBe('label');
  });

  it('should serialize to JSON', () => {
    const g = new DiagramGraph();
    g.addNode(DiagramNodeKind.Start, 'start');
    g.addNode(DiagramNodeKind.End, 'end');
    g.addEdge('n0', 'n1');

    const json = g.toJSON();
    expect(json.nodes).toHaveLength(2);
    expect(json.edges).toHaveLength(1);
  });

  it('should support all node kinds', () => {
    const g = new DiagramGraph();
    for (const kind of Object.values(DiagramNodeKind)) {
      g.addNode(kind as DiagramNodeKind, kind);
    }
    expect(g.nodes.length).toBe(Object.values(DiagramNodeKind).length);
  });

  it('should support dashed edges', () => {
    const g = new DiagramGraph();
    const n1 = g.addNode(DiagramNodeKind.Action, 'a');
    const n2 = g.addNode(DiagramNodeKind.Action, 'b');
    const e = g.addEdge(n1.id, n2.id, undefined, DiagramEdgeStyle.Dashed);
    expect(e.style).toBe(DiagramEdgeStyle.Dashed);
  });

  it('should set parent ID for group containment', () => {
    const g = new DiagramGraph();
    const group = g.addNode(DiagramNodeKind.Group, 'group');
    const child = g.addNode(DiagramNodeKind.Action, 'child', group.id);
    expect(child.parentId).toBe(group.id);
  });
});
