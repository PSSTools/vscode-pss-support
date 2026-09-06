import * as vscode from 'vscode';
import { ResourceBinding, ResourceTreeNode, bindingsToTree } from './resourceTree';

/**
 * TreeView showing resource binding topology: which actions
 * lock/share/input/output which resources.
 *
 * The grouping and labelling live in resourceTree.ts; this class only adapts
 * those nodes to vscode.TreeItem.
 */
export class ResourceTreeProvider implements vscode.TreeDataProvider<ResourceTreeItem> {
  private roots: ResourceTreeNode[] = [];
  private _onDidChangeTreeData = new vscode.EventEmitter<ResourceTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  public update(bindings: ResourceBinding[]): void {
    this.roots = bindingsToTree(bindings);
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ResourceTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ResourceTreeItem): ResourceTreeItem[] {
    const nodes = element ? (element.node.children ?? []) : this.roots;
    return nodes.map(node => new ResourceTreeItem(node));
  }
}

class ResourceTreeItem extends vscode.TreeItem {
  constructor(public readonly node: ResourceTreeNode) {
    super(
      node.label,
      node.collapsible
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = node.kind;
    if (node.uri && node.line !== undefined) {
      this.command = {
        command: 'vscode.open',
        title: 'Go to Source',
        arguments: [
          vscode.Uri.parse(node.uri),
          { selection: new vscode.Range(node.line, 0, node.line, 0) },
        ],
      };
    }
  }
}
