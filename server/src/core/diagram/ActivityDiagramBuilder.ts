import {
  ScopeChild,
  Scope,
  ActivityDecl,
  ActivitySequence,
  ActivityParallel,
  ActivitySchedule,
  ActivityActionHandleTraversal,
  ActivityActionTypeTraversal,
  ActivityIfElse,
  ActivitySelect,
  ActivitySelectBranch,
  ActivityMatch,
  ActivityRepeatCount,
  ActivityRepeatWhile,
  ActivityForeach,
  ActivityReplicate,
  ActivityConstraint,
  ActivityBindStmt,
  ActivityAtomicBlock,
  ActivitySuper,
  ActivityLabeledStmt,
  ActivityLabeledScope,
  ActivityStmt,
} from '../ast/generated';
import { DiagramGraph } from './DiagramGraph';
import { DiagramNodeKind } from '../types/DiagramNode';
import { DiagramEdgeStyle } from '../types/DiagramEdge';

/**
 * Walk an ActivityDecl AST and produce a DiagramGraph per the mapping
 * in DESIGN.md Section 8.2.
 */
export class ActivityDiagramBuilder {
  private graph!: DiagramGraph;
  private sourceUri?: string;

  public build(activity: ActivityDecl, sourceUri?: string): DiagramGraph {
    this.graph = new DiagramGraph();
    this.sourceUri = sourceUri;

    const start = this.graph.addNode(DiagramNodeKind.Start, 'start');
    const end = this.graph.addNode(DiagramNodeKind.End, 'end');

    const { entry, exit } = this.visitScope(activity);
    if (entry && exit) {
      this.graph.addEdge(start.id, entry);
      this.graph.addEdge(exit, end.id);
    } else {
      this.graph.addEdge(start.id, end.id);
    }

    return this.graph;
  }

  /**
   * Visit a scope (sequence of children) and return the entry/exit
   * node IDs for the chain.
   */
  private visitScope(scope: { children: ScopeChild[] }): { entry: string | null; exit: string | null } {
    let firstEntry: string | null = null;
    let prevExit: string | null = null;

    for (const child of scope.children) {
      const { entry, exit } = this.visitChild(child);
      if (!entry || !exit) continue;

      if (!firstEntry) {
        firstEntry = entry;
      }
      if (prevExit) {
        this.graph.addEdge(prevExit, entry);
      }
      prevExit = exit;
    }

    return { entry: firstEntry, exit: prevExit };
  }

  private visitChild(node: ScopeChild): { entry: string | null; exit: string | null } {
    if (node instanceof ActivitySequence) {
      return this.visitScope(node as any);
    }

    if (node instanceof ActivityParallel) {
      return this.visitParallel(node);
    }

    if (node instanceof ActivitySchedule) {
      return this.visitParallel(node); // Same fork/join structure
    }

    if (node instanceof ActivityActionHandleTraversal) {
      return this.visitActionTraversal(node);
    }

    if (node instanceof ActivityActionTypeTraversal) {
      return this.visitTypeTraversal(node);
    }

    if (node instanceof ActivityIfElse) {
      return this.visitIfElse(node);
    }

    if (node instanceof ActivitySelect) {
      return this.visitSelect(node);
    }

    if (node instanceof ActivityMatch) {
      return this.visitMatch(node);
    }

    if (node instanceof ActivityRepeatCount) {
      return this.visitRepeatCount(node);
    }

    if (node instanceof ActivityRepeatWhile) {
      return this.visitRepeatWhile(node);
    }

    if (node instanceof ActivityForeach) {
      return this.visitForeach(node);
    }

    if (node instanceof ActivityReplicate) {
      return this.visitReplicate(node);
    }

    if (node instanceof ActivityAtomicBlock) {
      return this.visitAtomic(node);
    }

    if (node instanceof ActivityConstraint) {
      // Constraints are annotations, not diagram nodes
      return { entry: null, exit: null };
    }

    if (node instanceof ActivityBindStmt) {
      return { entry: null, exit: null };
    }

    if (node instanceof ActivitySuper) {
      const n = this.graph.addNode(
        DiagramNodeKind.Action, 'super',
        undefined, this.sourceUri, this.lineOf(node),
      );
      return { entry: n.id, exit: n.id };
    }

    // Unknown activity child -- skip
    return { entry: null, exit: null };
  }

  private visitActionTraversal(node: ActivityActionHandleTraversal) {
    const label = node.target?.hier_id?.elems
      ?.map(e => e.id?.id).filter(Boolean).join('.') ?? 'do';
    const n = this.graph.addNode(
      DiagramNodeKind.Action, label,
      undefined, this.sourceUri, this.lineOf(node),
    );
    return { entry: n.id, exit: n.id };
  }

  private visitTypeTraversal(node: ActivityActionTypeTraversal) {
    const label = node.target?.type_id?.elems
      ?.map(e => e.id?.id).filter(Boolean).join('::') ?? 'do';
    const n = this.graph.addNode(
      DiagramNodeKind.Action, label,
      undefined, this.sourceUri, this.lineOf(node),
    );
    return { entry: n.id, exit: n.id };
  }

  private visitParallel(node: ActivityParallel | ActivitySchedule) {
    const fork = this.graph.addNode(DiagramNodeKind.Fork, 'fork');
    const join = this.graph.addNode(DiagramNodeKind.Join, 'join');

    for (const child of node.children) {
      const { entry, exit } = this.visitChild(child);
      if (entry && exit) {
        this.graph.addEdge(fork.id, entry);
        this.graph.addEdge(exit, join.id);
      }
    }

    return { entry: fork.id, exit: join.id };
  }

  private visitIfElse(node: ActivityIfElse) {
    const decision = this.graph.addNode(
      DiagramNodeKind.Decision, 'if',
      undefined, this.sourceUri, this.lineOf(node),
    );
    const merge = this.graph.addNode(DiagramNodeKind.Decision, 'merge');

    // True branch
    if (node.true_s) {
      const { entry, exit } = this.visitChild(node.true_s);
      if (entry && exit) {
        this.graph.addEdge(decision.id, entry, 'true');
        this.graph.addEdge(exit, merge.id);
      } else {
        this.graph.addEdge(decision.id, merge.id, 'true');
      }
    } else {
      this.graph.addEdge(decision.id, merge.id, 'true');
    }

    // False branch
    if (node.false_s) {
      const { entry, exit } = this.visitChild(node.false_s);
      if (entry && exit) {
        this.graph.addEdge(decision.id, entry, 'false');
        this.graph.addEdge(exit, merge.id);
      } else {
        this.graph.addEdge(decision.id, merge.id, 'false');
      }
    } else {
      this.graph.addEdge(decision.id, merge.id, 'false');
    }

    return { entry: decision.id, exit: merge.id };
  }

  private visitSelect(node: ActivitySelect) {
    const decision = this.graph.addNode(
      DiagramNodeKind.Decision, 'select',
      undefined, this.sourceUri, this.lineOf(node),
    );
    const merge = this.graph.addNode(DiagramNodeKind.Decision, 'merge');

    for (const branch of node.branches) {
      const label = branch.weight ? `w=${branch.weight}` : undefined;
      if (branch.body) {
        const { entry, exit } = this.visitChild(branch.body);
        if (entry && exit) {
          this.graph.addEdge(decision.id, entry, label);
          this.graph.addEdge(exit, merge.id);
          continue;
        }
      }
      this.graph.addEdge(decision.id, merge.id, label);
    }

    return { entry: decision.id, exit: merge.id };
  }

  private visitMatch(node: ActivityMatch) {
    const decision = this.graph.addNode(
      DiagramNodeKind.Decision, 'match',
      undefined, this.sourceUri, this.lineOf(node),
    );
    const merge = this.graph.addNode(DiagramNodeKind.Decision, 'merge');

    for (const choice of node.choices) {
      const label = choice.is_default ? 'default' : undefined;
      if (choice.body) {
        const { entry, exit } = this.visitChild(choice.body);
        if (entry && exit) {
          this.graph.addEdge(decision.id, entry, label);
          this.graph.addEdge(exit, merge.id);
          continue;
        }
      }
      this.graph.addEdge(decision.id, merge.id, label);
    }

    return { entry: decision.id, exit: merge.id };
  }

  private visitRepeatCount(node: ActivityRepeatCount) {
    const label = node.loop_var?.id
      ? `repeat(${node.loop_var.id})`
      : 'repeat';
    const actionNode = this.graph.addNode(
      DiagramNodeKind.Action, label,
      undefined, this.sourceUri, this.lineOf(node),
    );

    // If there's a body, build it and add a loop-back edge
    if (node.body) {
      const { entry, exit } = this.visitChild(node.body);
      if (entry && exit) {
        this.graph.addEdge(actionNode.id, entry);
        this.graph.addEdge(exit, actionNode.id, 'loop', DiagramEdgeStyle.Dashed);
        return { entry: actionNode.id, exit: actionNode.id };
      }
    }

    return { entry: actionNode.id, exit: actionNode.id };
  }

  private visitRepeatWhile(node: ActivityRepeatWhile) {
    const actionNode = this.graph.addNode(
      DiagramNodeKind.Decision, 'while',
      undefined, this.sourceUri, this.lineOf(node),
    );

    if (node.body) {
      const { entry, exit } = this.visitChild(node.body);
      if (entry && exit) {
        this.graph.addEdge(actionNode.id, entry, 'true');
        this.graph.addEdge(exit, actionNode.id, 'loop', DiagramEdgeStyle.Dashed);
      }
    }

    return { entry: actionNode.id, exit: actionNode.id };
  }

  private visitForeach(node: ActivityForeach) {
    const label = node.it_id?.id ? `foreach(${node.it_id.id})` : 'foreach';
    const actionNode = this.graph.addNode(
      DiagramNodeKind.Action, label,
      undefined, this.sourceUri, this.lineOf(node),
    );

    if (node.body) {
      const { entry, exit } = this.visitChild(node.body);
      if (entry && exit) {
        this.graph.addEdge(actionNode.id, entry);
        this.graph.addEdge(exit, actionNode.id, 'loop', DiagramEdgeStyle.Dashed);
      }
    }

    return { entry: actionNode.id, exit: actionNode.id };
  }

  private visitReplicate(node: ActivityReplicate) {
    const fork = this.graph.addNode(DiagramNodeKind.Fork, 'replicate');
    const join = this.graph.addNode(DiagramNodeKind.Join, 'join');

    if (node.body) {
      const { entry, exit } = this.visitChild(node.body);
      if (entry && exit) {
        this.graph.addEdge(fork.id, entry);
        this.graph.addEdge(exit, join.id);
      }
    }

    return { entry: fork.id, exit: join.id };
  }

  private visitAtomic(node: ActivityAtomicBlock) {
    if (node.body) {
      const group = this.graph.addNode(
        DiagramNodeKind.Group, 'atomic',
        undefined, this.sourceUri, this.lineOf(node),
      );
      const { entry, exit } = this.visitChild(node.body);
      // Mark child nodes as belonging to this group
      if (entry && exit) {
        return { entry, exit };
      }
    }
    return { entry: null, exit: null };
  }

  private lineOf(node: ScopeChild): number | undefined {
    return node.location.lineno >= 0 ? node.location.lineno - 1 : undefined;
  }
}
