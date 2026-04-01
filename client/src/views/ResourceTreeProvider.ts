import * as vscode from 'vscode';

interface ResourceBinding {
  actionName: string;
  resourceName: string;
  resourceType: string;
  kind: 'lock' | 'share' | 'input' | 'output';
  uri: string;
  line: number;
}

/**
 * TreeView showing resource binding topology: which actions
 * lock/share/input/output which resources.
 */
export class ResourceTreeProvider implements vscode.TreeDataProvider<ResourceTreeItem> {
  private bindings: ResourceBinding[] = [];
  private _onDidChangeTreeData = new vscode.EventEmitter<ResourceTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  public update(bindings: ResourceBinding[]): void {
    this.bindings = bindings;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ResourceTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ResourceTreeItem): ResourceTreeItem[] {
    if (!element) {
      // Root: group by action
      const actions = new Map<string, ResourceBinding[]>();
      for (const b of this.bindings) {
        if (!actions.has(b.actionName)) actions.set(b.actionName, []);
        actions.get(b.actionName)!.push(b);
      }
      return [...actions.entries()].map(([name, bindings]) =>
        new ResourceTreeItem(name, 'action', vscode.TreeItemCollapsibleState.Collapsed, bindings),
      );
    }

    // Children: individual bindings
    return (element.bindings ?? []).map(b =>
      new ResourceTreeItem(
        `${b.kind} ${b.resourceType} ${b.resourceName}`,
        b.kind,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        b.uri,
        b.line,
      ),
    );
  }
}

class ResourceTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly kind: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly bindings?: ResourceBinding[],
    uri?: string,
    line?: number,
  ) {
    super(label, collapsibleState);
    this.contextValue = kind;
    if (uri && line !== undefined) {
      this.command = {
        command: 'vscode.open',
        title: 'Go to Source',
        arguments: [vscode.Uri.parse(uri), { selection: new vscode.Range(line, 0, line, 0) }],
      };
    }
  }
}
