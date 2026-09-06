import * as vscode from 'vscode';
import { DiagramGraph, renderDiagramHtml } from './diagramHtml';

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
    this.panel.webview.html = renderDiagramHtml(graph);
  }

  public dispose(): void {
    ActivityDiagramPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
  }

}
