import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';
import { ActivityDiagramBuilder } from '../core/diagram/ActivityDiagramBuilder.js';
import { findActivityAtLine } from '../core/diagram/ActivityLookup.js';

export interface ActivityDiagramParams {
  uri: string;
  line: number;
}

/**
 * Handler for the custom `pss/activityDiagram` request that backs the
 * Activity Diagram webview. Returns the graph as plain JSON, or null when the
 * position is not inside an activity.
 */
export function handleActivityDiagram(
  params: ActivityDiagramParams,
  index: WorkspaceIndex,
): unknown | null {
  const ast = index.getAST(params.uri);
  if (!ast) return null;

  const activity = findActivityAtLine(ast, params.line);
  if (!activity) return null;

  const graph = new ActivityDiagramBuilder().build(activity, params.uri);
  return graph.toJSON();
}
