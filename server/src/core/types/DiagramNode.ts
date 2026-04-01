export enum DiagramNodeKind {
  Action = 'action',
  Fork = 'fork',
  Join = 'join',
  Decision = 'decision',
  Start = 'start',
  End = 'end',
  Group = 'group',
}

export interface DiagramNode {
  id: string;
  kind: DiagramNodeKind;
  label?: string;
  parentId?: string;
  sourceUri?: string;
  sourceLine?: number;
}
