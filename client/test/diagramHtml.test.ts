import { describe, it, expect } from 'vitest';
import { renderDiagramHtml, embedGraphJson, DiagramGraph } from '../src/views/diagramHtml';

/**
 * The webview builds its HTML by interpolating a graph -- whose labels come
 * from identifiers and expression text in the user's .pss files -- into an
 * inline <script>. These tests cover both halves of that: that the diagram
 * actually contains what the graph described, and that the graph cannot escape
 * the script element.
 */

const GRAPH: DiagramGraph = {
  nodes: [
    { id: 'n0', kind: 'start' },
    { id: 'n1', kind: 'action', label: 'write_a', sourceUri: 'file:///ws/a.pss', sourceLine: 4 },
    { id: 'n2', kind: 'decision', label: 'cond' },
    { id: 'n3', kind: 'end' },
  ],
  edges: [
    { id: 'e0', sourceId: 'n0', targetId: 'n1', style: 'solid' },
    { id: 'e1', sourceId: 'n1', targetId: 'n2', style: 'solid' },
    { id: 'e2', sourceId: 'n2', targetId: 'n3', label: 'else', style: 'dashed' },
  ],
};

describe('renderDiagramHtml', () => {
  it('produces a complete HTML document', () => {
    const html = renderDiagramHtml(GRAPH);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<svg id="diagram">');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('embeds every node and edge from the graph', () => {
    const html = renderDiagramHtml(GRAPH);
    const embedded = extractGraph(html);

    expect(embedded.nodes.map(n => n.id)).toEqual(['n0', 'n1', 'n2', 'n3']);
    expect(embedded.edges.map(e => e.id)).toEqual(['e0', 'e1', 'e2']);
  });

  it('preserves labels and source locations needed for navigation', () => {
    const embedded = extractGraph(renderDiagramHtml(GRAPH));
    const action = embedded.nodes.find(n => n.id === 'n1')!;

    expect(action.label).toBe('write_a');
    expect(action.sourceUri).toBe('file:///ws/a.pss');
    expect(action.sourceLine).toBe(4);
  });

  it('renders an empty graph without producing broken markup', () => {
    const html = renderDiagramHtml({ nodes: [], edges: [] });
    expect(extractGraph(html)).toEqual({ nodes: [], edges: [] });
  });
});

describe('embedGraphJson escaping', () => {
  it('neutralizes a closing script tag in a label', () => {
    const hostile: DiagramGraph = {
      nodes: [{ id: 'n0', kind: 'action', label: '</script><img src=x onerror=alert(1)>' }],
      edges: [],
    };
    const html = renderDiagramHtml(hostile);

    // Exactly one script element: the label did not terminate it early.
    expect(html.match(/<\/script>/g) ?? []).toHaveLength(1);
    expect(html).not.toContain('<img src=x');
  });

  it('round-trips the hostile label back to its original text', () => {
    const label = '</script><img src=x>';
    const embedded = extractGraph(renderDiagramHtml({
      nodes: [{ id: 'n0', kind: 'action', label }],
      edges: [],
    }));

    // Escaping must be lossless -- the user still sees their real label.
    expect(embedded.nodes[0].label).toBe(label);
  });

  it('escapes angle brackets and ampersands', () => {
    const json = embedGraphJson({
      nodes: [{ id: 'a<b>c&d', kind: 'action' }],
      edges: [],
    });
    expect(json).not.toMatch(/[<>&]/);
    expect(json).toContain('\\u003c');
    expect(json).toContain('\\u003e');
    expect(json).toContain('\\u0026');
  });

  it('escapes the line separators that would break a JS string literal', () => {
    const json = embedGraphJson({
      nodes: [{ id: 'n0', kind: 'action', label: 'a\u2028b\u2029c' }],
      edges: [],
    });
    expect(json).not.toContain('\u2028');
    expect(json).not.toContain('\u2029');
    expect(JSON.parse(json).nodes[0].label).toBe('a\u2028b\u2029c');
  });

  it('remains valid JSON after escaping', () => {
    expect(() => JSON.parse(embedGraphJson(GRAPH))).not.toThrow();
    expect(JSON.parse(embedGraphJson(GRAPH))).toEqual(GRAPH);
  });
});

/** Pull the embedded graph literal back out of the rendered page. */
function extractGraph(html: string): DiagramGraph {
  const match = html.match(/const graph = (.*);\n/);
  if (!match) throw new Error('no embedded graph found in rendered HTML');
  return JSON.parse(match[1]) as DiagramGraph;
}
