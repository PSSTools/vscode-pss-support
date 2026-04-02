import * as vscode from 'vscode';

interface DiagramNode {
  id: string;
  kind: string;
  label?: string;
  parentId?: string;
  sourceUri?: string;
  sourceLine?: number;
}

interface DiagramEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  style: string;
}

interface DiagramGraph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/**
 * Webview panel that renders an activity diagram from a DiagramGraph JSON.
 * Uses SVG rendering with basic layout.
 */
export class ActivityDiagramPanel {
  public static currentPanel: ActivityDiagramPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    graph: DiagramGraph,
    title: string,
  ): ActivityDiagramPanel {
    const column = vscode.ViewColumn.Beside;

    if (ActivityDiagramPanel.currentPanel) {
      ActivityDiagramPanel.currentPanel.panel.reveal(column);
      ActivityDiagramPanel.currentPanel.update(graph, title);
      return ActivityDiagramPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'pssActivityDiagram',
      title,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    ActivityDiagramPanel.currentPanel = new ActivityDiagramPanel(panel, graph, title);
    return ActivityDiagramPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, graph: DiagramGraph, title: string) {
    this.panel = panel;
    this.update(graph, title);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      message => {
        if (message.command === 'navigateToSource' && message.uri && message.line !== undefined) {
          const uri = vscode.Uri.parse(message.uri);
          vscode.window.showTextDocument(uri, {
            selection: new vscode.Range(message.line, 0, message.line, 0),
          });
        }
      },
      null,
      this.disposables,
    );
  }

  public update(graph: DiagramGraph, title: string): void {
    this.panel.title = title;
    this.panel.webview.html = this.getHtml(graph);
  }

  public dispose(): void {
    ActivityDiagramPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
  }

  private getHtml(graph: DiagramGraph): string {
    const graphJson = JSON.stringify(graph);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activity Diagram</title>
  <style>
    body { margin: 0; padding: 16px; font-family: var(--vscode-font-family, sans-serif); background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-editor-foreground, #ccc); }
    svg { width: 100%; height: calc(100vh - 32px); }
    .node rect { fill: var(--vscode-badge-background, #333); stroke: var(--vscode-focusBorder, #007acc); stroke-width: 1.5; rx: 6; cursor: pointer; }
    .node text { fill: var(--vscode-editor-foreground, #ccc); font-size: 12px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
    .node.start circle, .node.end circle { fill: var(--vscode-focusBorder, #007acc); }
    .node.fork rect, .node.join rect { fill: var(--vscode-focusBorder, #007acc); height: 4px; }
    .node.decision polygon { fill: var(--vscode-badge-background, #333); stroke: var(--vscode-focusBorder, #007acc); stroke-width: 1.5; }
    .edge line, .edge path { stroke: var(--vscode-editor-foreground, #888); stroke-width: 1; marker-end: url(#arrow); }
    .edge.dashed line, .edge.dashed path { stroke-dasharray: 5,3; }
    .edge-label { fill: var(--vscode-descriptionForeground, #999); font-size: 10px; }
    .node:hover rect { stroke-width: 2.5; }
  </style>
</head>
<body>
  <svg id="diagram"></svg>
  <script>
    const vscode = acquireVsCodeApi();
    const graph = ${graphJson};
    renderDiagram(graph);

    function renderDiagram(graph) {
      const svg = document.getElementById('diagram');
      const ns = 'http://www.w3.org/2000/svg';

      // Add arrow marker
      const defs = document.createElementNS(ns, 'defs');
      const marker = document.createElementNS(ns, 'marker');
      marker.setAttribute('id', 'arrow');
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '10');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      path.setAttribute('fill', '#888');
      marker.appendChild(path);
      defs.appendChild(marker);
      svg.appendChild(defs);

      // Simple top-down layout
      const nodeWidth = 140;
      const nodeHeight = 36;
      const ySpacing = 60;
      const xCenter = 300;

      const positions = new Map();
      let y = 30;

      for (const node of graph.nodes) {
        positions.set(node.id, { x: xCenter, y });
        y += ySpacing;
      }

      // Draw edges
      for (const edge of graph.edges) {
        const from = positions.get(edge.sourceId);
        const to = positions.get(edge.targetId);
        if (!from || !to) continue;

        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'edge' + (edge.style === 'dashed' ? ' dashed' : ''));
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', String(from.x));
        line.setAttribute('y1', String(from.y + nodeHeight / 2));
        line.setAttribute('x2', String(to.x));
        line.setAttribute('y2', String(to.y - nodeHeight / 2));
        g.appendChild(line);

        if (edge.label) {
          const label = document.createElementNS(ns, 'text');
          label.setAttribute('class', 'edge-label');
          label.setAttribute('x', String((from.x + to.x) / 2 + 8));
          label.setAttribute('y', String((from.y + to.y) / 2));
          label.textContent = edge.label;
          g.appendChild(label);
        }
        svg.appendChild(g);
      }

      // Draw nodes
      for (const node of graph.nodes) {
        const pos = positions.get(node.id);
        if (!pos) continue;

        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'node ' + node.kind);
        g.setAttribute('transform', 'translate(' + (pos.x - nodeWidth / 2) + ',' + (pos.y - nodeHeight / 2) + ')');

        if (node.kind === 'start' || node.kind === 'end') {
          const circle = document.createElementNS(ns, 'circle');
          circle.setAttribute('cx', String(nodeWidth / 2));
          circle.setAttribute('cy', String(nodeHeight / 2));
          circle.setAttribute('r', '10');
          g.appendChild(circle);
        } else if (node.kind === 'decision') {
          const poly = document.createElementNS(ns, 'polygon');
          const cx = nodeWidth / 2, cy = nodeHeight / 2, s = 18;
          poly.setAttribute('points', cx + ',' + (cy - s) + ' ' + (cx + s) + ',' + cy + ' ' + cx + ',' + (cy + s) + ' ' + (cx - s) + ',' + cy);
          g.appendChild(poly);
        } else if (node.kind === 'fork' || node.kind === 'join') {
          const rect = document.createElementNS(ns, 'rect');
          rect.setAttribute('width', String(nodeWidth));
          rect.setAttribute('height', '4');
          rect.setAttribute('y', String(nodeHeight / 2 - 2));
          g.appendChild(rect);
        } else {
          const rect = document.createElementNS(ns, 'rect');
          rect.setAttribute('width', String(nodeWidth));
          rect.setAttribute('height', String(nodeHeight));
          g.appendChild(rect);
        }

        if (node.label) {
          const text = document.createElementNS(ns, 'text');
          text.setAttribute('x', String(nodeWidth / 2));
          text.setAttribute('y', String(nodeHeight / 2));
          text.textContent = node.label;
          g.appendChild(text);
        }

        if (node.sourceUri !== undefined) {
          g.addEventListener('click', () => {
            vscode.postMessage({ command: 'navigateToSource', uri: node.sourceUri, line: node.sourceLine || 0 });
          });
        }

        svg.appendChild(g);
      }
    }
  </script>
</body>
</html>`;
  }
}
