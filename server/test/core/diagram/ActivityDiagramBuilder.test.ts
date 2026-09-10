import { describe, it, expect } from 'vitest';
import { parseSource } from '../../helpers/ParseHelper.js';
import { ActivityDiagramBuilder } from '../../../src/core/diagram/ActivityDiagramBuilder.js';
import { ActivityDecl, Action, Scope } from '../../../src/core/ast/generated/index.js';
import { DiagramNodeKind } from '../../../src/core/types/DiagramNode.js';
import { walkScope } from '../../../src/core/ast/ASTUtils.js';

function buildActivity(source: string): ActivityDecl | null {
  const ast = parseSource(source)!;

  for (const child of walkScope(ast)) {
    if (child instanceof ActivityDecl) return child;
  }
  return null;
}

describe('ActivityDiagramBuilder', () => {
  it('should produce start and end nodes for empty activity', () => {
    const activity = buildActivity('component c { action a { activity { } } }');
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    const start = graph.nodes.find(n => n.kind === DiagramNodeKind.Start);
    const end = graph.nodes.find(n => n.kind === DiagramNodeKind.End);
    expect(start).toBeDefined();
    expect(end).toBeDefined();
  });

  it('should produce action node for type traversal', () => {
    const activity = buildActivity(`
      component c {
        action sub_a { }
        action main_a {
          activity {
            do sub_a;
          }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    const actionNodes = graph.nodes.filter(n => n.kind === DiagramNodeKind.Action);
    expect(actionNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce fork and join for parallel block', () => {
    const activity = buildActivity(`
      component c {
        action a1 { }
        action a2 { }
        action main {
          activity {
            parallel {
              do a1;
              do a2;
            }
          }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    const forks = graph.nodes.filter(n => n.kind === DiagramNodeKind.Fork);
    const joins = graph.nodes.filter(n => n.kind === DiagramNodeKind.Join);
    expect(forks.length).toBeGreaterThanOrEqual(1);
    expect(joins.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce decision node for if/else', () => {
    const activity = buildActivity(`
      component c {
        action a1 { }
        action a2 { }
        action main {
          rand bit[1] flag;
          activity {
            if (flag) {
              do a1;
            } else {
              do a2;
            }
          }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    const decisions = graph.nodes.filter(n => n.kind === DiagramNodeKind.Decision);
    expect(decisions.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce decision node for select', () => {
    const activity = buildActivity(`
      component c {
        action a1 { }
        action a2 { }
        action main {
          activity {
            select {
              do a1;
              do a2;
            }
          }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    const decisions = graph.nodes.filter(n => n.kind === DiagramNodeKind.Decision);
    expect(decisions.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle repeat count', () => {
    const activity = buildActivity(`
      component c {
        action a1 { }
        action main {
          activity {
            repeat (i : 10) {
              do a1;
            }
          }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    // Should have at least start, end, and some action/loop nodes
    expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('should produce edges between sequential actions', () => {
    const activity = buildActivity(`
      component c {
        action a1 { }
        action a2 { }
        action main {
          activity {
            do a1;
            do a2;
          }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    expect(graph.edges.length).toBeGreaterThanOrEqual(3); // start->a1, a1->a2, a2->end
  });

  it('should handle empty activity gracefully', () => {
    const activity = buildActivity('component c { action a { activity { } } }');
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    // At minimum, start and end connected
    expect(graph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce JSON-serializable output', () => {
    const activity = buildActivity(`
      component c {
        action a1 { }
        action main {
          activity { do a1; }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    const json = graph.toJSON();
    const str = JSON.stringify(json);
    const parsed = JSON.parse(str);
    expect(parsed.nodes.length).toBe(json.nodes.length);
    expect(parsed.edges.length).toBe(json.edges.length);
  });

  it('should handle nested parallel inside sequence', () => {
    const activity = buildActivity(`
      component c {
        action a1 { }
        action a2 { }
        action a3 { }
        action main {
          activity {
            do a1;
            parallel {
              do a2;
              do a3;
            }
          }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!);

    expect(graph.nodes.length).toBeGreaterThanOrEqual(6); // start, a1, fork, a2, a3, join, end
  });

  it('should include source line info on action nodes', () => {
    const activity = buildActivity(`
      component c {
        action a1 { }
        action main {
          activity { do a1; }
        }
      }
    `);
    expect(activity).not.toBeNull();

    const builder = new ActivityDiagramBuilder();
    const graph = builder.build(activity!, 'file:///test.pss');

    const actionNodes = graph.nodes.filter(n => n.kind === DiagramNodeKind.Action);
    for (const n of actionNodes) {
      expect(n.sourceLine).toBeDefined();
    }
  });
});
