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
  MonitorActivityActionTraversal,
  MonitorActivityRepeatCount,
  MonitorActivityRepeatWhile,
  MonitorActivityIfElse,
  MonitorActivityMatch,
  SymbolChildrenScope,
} from '../ast/generated';
import { DiagramGraph } from './DiagramGraph';
import { DiagramNodeKind } from '../types/DiagramNode';
import { DiagramEdgeStyle } from '../types/DiagramEdge';

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
    if (node instanceof MonitorActivityActionTraversal) {
      const label = 'action';
      const n = this.graph.addNode(DiagramNodeKind.Action, label);
      return { entry: n.id, exit: n.id };
    }
    if (node instanceof MonitorActivityIfElse) {
      return this.visitIfElse(node);
    }
    if (node instanceof MonitorActivityRepeatCount || node instanceof MonitorActivityRepeatWhile) {
      const n = this.graph.addNode(DiagramNodeKind.Action, 'repeat');
      return { entry: n.id, exit: n.id };
    }
    if (node instanceof MonitorActivitySequence || node instanceof MonitorActivitySelect) {
      if ('children' in node) {
        return this.visitScope(node as any);
      }
    }
    return { entry: null, exit: null };
  }

  private visitConcat(node: MonitorActivityConcat): { entry: string | null; exit: string | null } {
    const lhs = node.lhs ? this.visitStmt(node.lhs) : { entry: null, exit: null };
    const rhs = node.rhs ? this.visitStmt(node.rhs) : { entry: null, exit: null };

    if (lhs.exit && rhs.entry) {
      this.graph.addEdge(lhs.exit, rhs.entry, '##');
    }

    return {
      entry: lhs.entry ?? rhs.entry,
      exit: rhs.exit ?? lhs.exit,
    };
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

    const lhs = node.lhs ? this.visitStmt(node.lhs) : { entry: null, exit: null };
    const rhs = node.rhs ? this.visitStmt(node.rhs) : { entry: null, exit: null };

    if (lhs.entry && lhs.exit) {
      this.graph.addEdge(fork.id, lhs.entry);
      this.graph.addEdge(lhs.exit, join.id);
    }
    if (rhs.entry && rhs.exit) {
      this.graph.addEdge(fork.id, rhs.entry);
      this.graph.addEdge(rhs.exit, join.id);
    }

    return { entry: fork.id, exit: join.id };
  }

  private visitIfElse(node: MonitorActivityIfElse): { entry: string | null; exit: string | null } {
    const decision = this.graph.addNode(DiagramNodeKind.Decision, 'if');
    const merge = this.graph.addNode(DiagramNodeKind.Decision, 'merge');

    if (node.true_s) {
      const t = this.visitStmt(node.true_s);
      if (t.entry && t.exit) {
        this.graph.addEdge(decision.id, t.entry, 'true');
        this.graph.addEdge(t.exit, merge.id);
      } else {
        this.graph.addEdge(decision.id, merge.id, 'true');
      }
    }
    if (node.false_s) {
      const f = this.visitStmt(node.false_s);
      if (f.entry && f.exit) {
        this.graph.addEdge(decision.id, f.entry, 'false');
        this.graph.addEdge(f.exit, merge.id);
      } else {
        this.graph.addEdge(decision.id, merge.id, 'false');
      }
    }

    return { entry: decision.id, exit: merge.id };
  }
}
