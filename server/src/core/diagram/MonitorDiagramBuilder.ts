import {
  ScopeChild,
  Scope,
  MonitorActivityDecl,
  MonitorActivityStmt,
  MonitorActivityConcat,
  MonitorActivityEventually,
  MonitorActivityOverlap,
  MonitorActivitySequence,
  MonitorActivitySelect,
  MonitorActivitySchedule,
  ActivityActionHandleTraversal,
  ActivityActionTypeTraversal,
  SymbolChildrenScope,
} from '../ast/generated/index.js';
import { DiagramGraph } from './DiagramGraph.js';
import { DiagramNodeKind } from '../types/DiagramNode.js';
import { DiagramEdgeStyle } from '../types/DiagramEdge.js';

/**
 * Map MonitorActivityDecl AST to a DiagramGraph with temporal
 * edge styles (dashed for eventually, labeled for concat).
 */
export class MonitorDiagramBuilder {
  private graph!: DiagramGraph;

  public build(monitor: MonitorActivityDecl): DiagramGraph {
    this.graph = new DiagramGraph();

    const start = this.graph.addNode(DiagramNodeKind.Start, 'start');
    const end = this.graph.addNode(DiagramNodeKind.End, 'end');

    const { entry, exit } = this.visitScope(monitor);
    if (entry && exit) {
      this.graph.addEdge(start.id, entry);
      this.graph.addEdge(exit, end.id);
    } else {
      this.graph.addEdge(start.id, end.id);
    }

    return this.graph;
  }

  private visitScope(scope: { children: ScopeChild[] }): { entry: string | null; exit: string | null } {
    let firstEntry: string | null = null;
    let prevExit: string | null = null;

    for (const child of scope.children) {
      const r = this.visitStmt(child);
      if (!r.entry || !r.exit) continue;
      if (!firstEntry) firstEntry = r.entry;
      if (prevExit) this.graph.addEdge(prevExit, r.entry);
      prevExit = r.exit;
    }

    return { entry: firstEntry, exit: prevExit };
  }

  private visitStmt(node: ScopeChild): { entry: string | null; exit: string | null } {
    if (node instanceof MonitorActivityConcat) {
      return this.visitConcat(node);
    }
    if (node instanceof MonitorActivityEventually) {
      return this.visitEventually(node);
    }
    if (node instanceof MonitorActivityOverlap) {
      return this.visitOverlap(node);
    }
    // Monitor activities reuse the generic activity traversal nodes rather
    // than carrying monitor-specific ones.
    if (
      node instanceof ActivityActionHandleTraversal ||
      node instanceof ActivityActionTypeTraversal
    ) {
      const n = this.graph.addNode(DiagramNodeKind.Action, 'action');
      return { entry: n.id, exit: n.id };
    }
    if (
      node instanceof MonitorActivitySequence ||
      node instanceof MonitorActivitySelect ||
      node instanceof MonitorActivitySchedule
    ) {
      return this.visitScope(node);
    }
    return { entry: null, exit: null };
  }

  /**
   * `a ## b ## c` -- chained with '##'-labelled edges.
   *
   * Concat is an n-ary scope holding its operands as children, not a binary
   * node with lhs/rhs. Two operands are the common case but not the only one,
   * and a binary reading would silently drop the third.
   */
  private visitConcat(node: MonitorActivityConcat): { entry: string | null; exit: string | null } {
    let firstEntry: string | null = null;
    let prevExit: string | null = null;

    for (const child of node.children) {
      const r = this.visitStmt(child);
      if (!r.entry || !r.exit) continue;
      if (!firstEntry) firstEntry = r.entry;
      if (prevExit) this.graph.addEdge(prevExit, r.entry, '##');
      prevExit = r.exit;
    }

    return { entry: firstEntry, exit: prevExit };
  }

  private visitEventually(node: MonitorActivityEventually): { entry: string | null; exit: string | null } {
    const body = node.body ? this.visitStmt(node.body) : { entry: null, exit: null };
    if (body.entry) {
      // Mark the incoming edge as dashed (eventual)
      const placeholder = this.graph.addNode(DiagramNodeKind.Action, 'eventually');
      this.graph.addEdge(placeholder.id, body.entry, 'eventually', DiagramEdgeStyle.Dashed);
      return { entry: placeholder.id, exit: body.exit };
    }
    const n = this.graph.addNode(DiagramNodeKind.Action, 'eventually');
    return { entry: n.id, exit: n.id };
  }

  private visitOverlap(node: MonitorActivityOverlap): { entry: string | null; exit: string | null } {
    const fork = this.graph.addNode(DiagramNodeKind.Fork, 'overlap');
    const join = this.graph.addNode(DiagramNodeKind.Join, 'join');

    // Also n-ary: every operand runs concurrently between the fork and join.
    for (const child of node.children) {
      const r = this.visitStmt(child);
      if (!r.entry || !r.exit) continue;
      this.graph.addEdge(fork.id, r.entry);
      this.graph.addEdge(r.exit, join.id);
    }

    return { entry: fork.id, exit: join.id };
  }
}
