import { describe, it, expect } from 'vitest';
import { DiagramGraph } from '../../../src/core/diagram/DiagramGraph';
import { MonitorDiagramBuilder } from '../../../src/core/diagram/MonitorDiagramBuilder';
import { MonitorActivityDecl, MonitorActivityConcat, MonitorActivityEventually, MonitorActivityOverlap, MonitorActivityActionTraversal } from '../../../src/core/ast/generated';
import { DiagramNodeKind } from '../../../src/core/types/DiagramNode';
import { DiagramEdgeStyle } from '../../../src/core/types/DiagramEdge';

describe('MonitorDiagramBuilder', () => {
  it('should produce start and end for empty monitor', () => {
    const monitor = new MonitorActivityDecl();
    const builder = new MonitorDiagramBuilder();
    const graph = builder.build(monitor);

    expect(graph.nodes.find(n => n.kind === DiagramNodeKind.Start)).toBeDefined();
    expect(graph.nodes.find(n => n.kind === DiagramNodeKind.End)).toBeDefined();
  });

  it('should produce dashed edge for eventually', () => {
    const monitor = new MonitorActivityDecl();
    const evt = new MonitorActivityEventually();
    const action = new MonitorActivityActionTraversal();
    evt.body = action;
    monitor.children.push(evt);

    const builder = new MonitorDiagramBuilder();
    const graph = builder.build(monitor);

    const dashedEdges = graph.edges.filter(e => e.style === DiagramEdgeStyle.Dashed);
    expect(dashedEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce fork/join for overlap', () => {
    const monitor = new MonitorActivityDecl();
    const overlap = new MonitorActivityOverlap();
    overlap.lhs = new MonitorActivityActionTraversal();
    overlap.rhs = new MonitorActivityActionTraversal();
    monitor.children.push(overlap);

    const builder = new MonitorDiagramBuilder();
    const graph = builder.build(monitor);

    expect(graph.nodes.filter(n => n.kind === DiagramNodeKind.Fork).length).toBeGreaterThanOrEqual(1);
    expect(graph.nodes.filter(n => n.kind === DiagramNodeKind.Join).length).toBeGreaterThanOrEqual(1);
  });

  it('should produce labeled edge for concat', () => {
    const monitor = new MonitorActivityDecl();
    const concat = new MonitorActivityConcat();
    concat.lhs = new MonitorActivityActionTraversal();
    concat.rhs = new MonitorActivityActionTraversal();
    monitor.children.push(concat);

    const builder = new MonitorDiagramBuilder();
    const graph = builder.build(monitor);

    const labeledEdges = graph.edges.filter(e => e.label === '##');
    expect(labeledEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('should serialize to JSON', () => {
    const monitor = new MonitorActivityDecl();
    const builder = new MonitorDiagramBuilder();
    const graph = builder.build(monitor);

    const json = graph.toJSON();
    expect(JSON.stringify(json)).toBeDefined();
  });

  it('should handle action traversal node', () => {
    const monitor = new MonitorActivityDecl();
    monitor.children.push(new MonitorActivityActionTraversal());

    const builder = new MonitorDiagramBuilder();
    const graph = builder.build(monitor);

    const actionNodes = graph.nodes.filter(n => n.kind === DiagramNodeKind.Action);
    expect(actionNodes.length).toBeGreaterThanOrEqual(1);
  });
});
