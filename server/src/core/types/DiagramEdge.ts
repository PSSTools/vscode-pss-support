export enum DiagramEdgeStyle {
  Solid = 'solid',
  Dashed = 'dashed',
}

export interface DiagramEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  style: DiagramEdgeStyle;
}
