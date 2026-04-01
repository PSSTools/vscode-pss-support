import { DiagramNode, DiagramNodeKind } from '../types/DiagramNode';
import { DiagramEdge, DiagramEdgeStyle } from '../types/DiagramEdge';

/**
 * Plain data model for directed graphs used by activity diagram
 * visualization. Contains nodes and edges with optional group
 * containment for parallel/schedule blocks.
 */
export class DiagramGraph {
  public nodes: DiagramNode[] = [];
  public edges: DiagramEdge[] = [];
  private nextId = 0;

  public addNode(
    kind: DiagramNodeKind,
    label?: string,
    parentId?: string,
    sourceUri?: string,
    sourceLine?: number,
  ): DiagramNode {
    const node: DiagramNode = {
      id: `n${this.nextId++}`,
      kind,
      label,
      parentId,
      sourceUri,
      sourceLine,
    };
    this.nodes.push(node);
    return node;
  }

  public addEdge(
    sourceId: string,
    targetId: string,
    label?: string,
    style: DiagramEdgeStyle = DiagramEdgeStyle.Solid,
  ): DiagramEdge {
    const edge: DiagramEdge = {
      id: `e${this.nextId++}`,
      sourceId,
      targetId,
      label,
      style,
    };
    this.edges.push(edge);
    return edge;
  }

  /** Serialize to a plain JSON-compatible object. */
  public toJSON(): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
    return { nodes: this.nodes, edges: this.edges };
  }
}
