export interface ResourceBinding {
  actionName: string;
  resourceName: string;
  resourceType: string;
  kind: 'lock' | 'share' | 'input' | 'output';
  uri: string;
  line: number;
}

/** A node in the resource tree, independent of any vscode.TreeItem. */
export interface ResourceTreeNode {
  label: string;
  kind: string;
  /** True when the node groups children (an action); false for a leaf binding. */
  collapsible: boolean;
  children?: ResourceTreeNode[];
  uri?: string;
  line?: number;
}

/**
 * Shape resource bindings into the tree the view renders: one group per action,
 * one leaf per binding.
 *
 * Pure, so the grouping and labelling can be tested without a TreeDataProvider.
 * Actions and their bindings keep first-seen order, which keeps the view stable
 * as the workspace is re-analyzed.
 */
export function bindingsToTree(bindings: ResourceBinding[]): ResourceTreeNode[] {
  const byAction = new Map<string, ResourceBinding[]>();

  for (const binding of bindings) {
    const existing = byAction.get(binding.actionName);
    if (existing) existing.push(binding);
    else byAction.set(binding.actionName, [binding]);
  }

  return [...byAction.entries()].map(([actionName, actionBindings]) => ({
    label: actionName,
    kind: 'action',
    collapsible: true,
    children: actionBindings.map(b => ({
      label: `${b.kind} ${b.resourceType} ${b.resourceName}`,
      kind: b.kind,
      collapsible: false,
      uri: b.uri,
      line: b.line,
    })),
  }));
}
