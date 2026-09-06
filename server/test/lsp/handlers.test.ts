import { describe, it, expect } from 'vitest';
import { TestProject } from '../helpers/TestProject';
import { handleHover } from '../../src/lsp/LspHoverHandler';
import { handleDefinition } from '../../src/lsp/LspDefinitionHandler';
import { handleReferences } from '../../src/lsp/LspReferencesHandler';
import { handleCompletion, handleCompletionResolve } from '../../src/lsp/LspCompletionHandler';
import { handleSignatureHelp } from '../../src/lsp/LspSignatureHelpHandler';
import { handleFoldingRanges } from '../../src/lsp/LspFoldingHandler';
import { handleSemanticTokensFull } from '../../src/lsp/LspSemanticTokensHandler';
import { handlePrepareRename, handleRename } from '../../src/lsp/LspRenameHandler';
import { handleCodeAction } from '../../src/lsp/LspCodeActionHandler';
import { handleInlayHints } from '../../src/lsp/LspInlayHintHandler';
import { handleCodeLens } from '../../src/lsp/LspCodeLensHandler';
import { handleFormatting, handleRangeFormatting } from '../../src/lsp/LspFormattingHandler';
import { handleWorkspaceSymbol } from '../../src/lsp/LspWorkspaceSymbolHandler';
import { handleActivityDiagram } from '../../src/lsp/LspActivityDiagramHandler';
import { handlePrepareCallHierarchy } from '../../src/lsp/LspCallHierarchyHandler';
import { handlePrepareTypeHierarchy } from '../../src/lsp/LspTypeHierarchyHandler';
import { CompletionItemKind, SymbolKind as LspSymbolKind } from 'vscode-languageserver/node';

/**
 * Adapter-layer tests: assert the shape that actually crosses the process
 * boundary. Core tests cover the logic; these cover the translation, which is
 * where a handler wired to the wrong service or a dropped field would hide.
 */

function project() {
  return TestProject.fromFiles({
    'pkg.pss': [
      'package p {',
      '    struct /*[decl_s]*/data_s {',
      '        rand bit[32] addr;',
      '    }',
      '    function void helper(int a, int b);',
      '}',
    ].join('\n'),
    'top.pss': [
      'import p::*;',
      'component /*[decl_c]*/top_c {',
      '    /*[use_s]*/data_s cfg;',
      '    action Entry {',
      '        activity {',
      '            do other_a;',
      '        }',
      '    }',
      '    action other_a { }',
      '}',
    ].join('\n'),
  });
}

/** LSP requires formatting options on the request; the service ignores them. */
const FMT_OPTS = { tabSize: 4, insertSpaces: true };

const at = (uri: string, line: number, character: number) => ({
  textDocument: { uri },
  position: { line, character },
});

describe('LspHoverHandler', () => {
  it('returns markdown contents with a range', () => {
    const p = project();
    const pos = p.position('top.pss', 'decl_c');
    const hover = handleHover(at(p.uri('top.pss'), pos.line, pos.character), p.index);

    expect(hover).not.toBeNull();
    expect(hover!.contents).toMatchObject({ kind: 'markdown' });
    expect((hover!.contents as { value: string }).value).toContain('top_c');
  });

  it('returns null where there is nothing to describe', () => {
    const p = project();
    expect(handleHover(at(p.uri('top.pss'), 0, 0), p.index)).toBeNull();
  });
});

describe('LspDefinitionHandler', () => {
  it('returns Locations carrying the target uri', () => {
    const p = project();
    const pos = p.position('top.pss', 'use_s');
    const locations = handleDefinition(at(p.uri('top.pss'), pos.line, pos.character), p.index);

    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0].uri).toBe(p.uri('pkg.pss'));
    expect(locations[0].range.start.line).toBe(1);
  });

  it('returns an empty array rather than null when nothing resolves', () => {
    const p = project();
    expect(handleDefinition(at(p.uri('top.pss'), 0, 0), p.index)).toEqual([]);
  });
});

describe('LspReferencesHandler', () => {
  it('returns Locations for a declaration', () => {
    const p = project();
    const pos = p.position('pkg.pss', 'decl_s');
    const refs = handleReferences(
      { ...at(p.uri('pkg.pss'), pos.line, pos.character), context: { includeDeclaration: true } },
      p.index,
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref.uri).toMatch(/^file:\/\//);
  });
});

describe('LspCompletionHandler', () => {
  it('returns a CompletionList with converted kinds', () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package p { struct s1 { } }',
      'top.pss': 'component top {\n    p::\n}',
    });
    const list = handleCompletion(at(p.uri('top.pss'), 1, 7), p.index);

    expect(list.isIncomplete).toBe(false);
    expect(list.items.length).toBeGreaterThan(0);
    const struct = list.items.find(i => i.label === 's1');
    expect(struct?.kind).toBe(CompletionItemKind.Struct);
  });

  it('carries a data payload so resolve can find the item again', () => {
    const p = project();
    const list = handleCompletion(at(p.uri('top.pss'), 2, 4), p.index);
    for (const item of list.items) {
      expect(item.data).toMatchObject({ label: item.label });
    }
  });

  it('resolve returns the item unchanged when it already has documentation', () => {
    const p = project();
    const item = { label: 'data_s', documentation: 'already here', data: { label: 'data_s' } };
    expect(handleCompletionResolve(item, p.index).documentation).toBe('already here');
  });
});

describe('LspSignatureHelpHandler', () => {
  it('returns a signature help shape or null, never undefined', () => {
    const p = project();
    const help = handleSignatureHelp(at(p.uri('top.pss'), 0, 0), p.index);
    expect(help === null || typeof help === 'object').toBe(true);
  });
});

describe('LspFoldingHandler', () => {
  it('returns ranges with numeric start and end lines', () => {
    const p = project();
    const ranges = handleFoldingRanges({ textDocument: { uri: p.uri('top.pss') } }, p.index);

    expect(ranges.length).toBeGreaterThan(0);
    for (const r of ranges) {
      expect(typeof r.startLine).toBe('number');
      expect(typeof r.endLine).toBe('number');
      expect(r.endLine).toBeGreaterThanOrEqual(r.startLine);
    }
  });
});

describe('LspSemanticTokensHandler', () => {
  it('emits a flat array of 5-tuples with delta encoding', () => {
    const p = project();
    const result = handleSemanticTokensFull({ textDocument: { uri: p.uri('pkg.pss') } }, p.index);

    expect(result.data.length % 5).toBe(0);
    expect(result.data.length).toBeGreaterThan(0);

    // Deltas must be non-negative: the first entry is absolute, and each
    // subsequent line delta counts forward from the previous token.
    for (let i = 0; i < result.data.length; i += 5) {
      expect(result.data[i], `deltaLine at tuple ${i / 5}`).toBeGreaterThanOrEqual(0);
      expect(result.data[i + 1], `deltaStart at tuple ${i / 5}`).toBeGreaterThanOrEqual(0);
      expect(result.data[i + 2], `length at tuple ${i / 5}`).toBeGreaterThan(0);
    }
  });

  it('decodes back to the original token positions', () => {
    const p = project();
    const tokens = p.semanticTokens('pkg.pss');
    const { data } = handleSemanticTokensFull({ textDocument: { uri: p.uri('pkg.pss') } }, p.index);

    const decoded: Array<{ line: number; startChar: number; length: number }> = [];
    let line = 0;
    let char = 0;
    for (let i = 0; i < data.length; i += 5) {
      line += data[i];
      char = data[i] === 0 ? char + data[i + 1] : data[i + 1];
      decoded.push({ line, startChar: char, length: data[i + 2] });
    }

    expect(decoded).toEqual(
      tokens.map(t => ({ line: t.line, startChar: t.startChar, length: t.length })),
    );
  });
});

describe('LspRenameHandler', () => {
  it('prepareRename returns the range of the identifier', () => {
    const p = project();
    const pos = p.position('pkg.pss', 'decl_s');
    const result = handlePrepareRename(at(p.uri('pkg.pss'), pos.line, pos.character), p.index);
    expect(result).not.toBeNull();
  });

  it('rename returns a WorkspaceEdit keyed by uri', () => {
    const p = project();
    const pos = p.position('pkg.pss', 'decl_s');
    const edit = handleRename(
      { ...at(p.uri('pkg.pss'), pos.line, pos.character), newName: 'renamed_s' },
      p.index,
    );

    expect(edit).not.toBeNull();
    expect(edit!.changes).toBeDefined();
    for (const uri of Object.keys(edit!.changes!)) {
      expect(uri).toMatch(/^file:\/\//);
    }
  });
});

describe('LspCodeActionHandler', () => {
  it('returns an array for a file with no diagnostics', () => {
    const p = project();
    const actions = handleCodeAction({
      textDocument: { uri: p.uri('top.pss') },
      range: p.wholeFileRange('top.pss'),
      context: { diagnostics: [] },
    }, p.index);
    expect(Array.isArray(actions)).toBe(true);
  });
});

describe('LspInlayHintHandler', () => {
  it('returns hints with positions and string labels', () => {
    const p = project();
    const hints = handleInlayHints({
      textDocument: { uri: p.uri('top.pss') },
      range: p.wholeFileRange('top.pss'),
    }, p.index);

    expect(Array.isArray(hints)).toBe(true);
    for (const hint of hints) {
      expect(hint.position).toMatchObject({ line: expect.any(Number) });
      expect(typeof hint.label).toBe('string');
    }
  });
});

describe('LspCodeLensHandler', () => {
  it('returns lenses with a command', () => {
    const p = project();
    const lenses = handleCodeLens({ textDocument: { uri: p.uri('pkg.pss') } }, p.index);

    expect(lenses.length).toBeGreaterThan(0);
    for (const lens of lenses) {
      expect(lens.command?.command).toBeTruthy();
      expect(lens.command?.title).toBeTruthy();
    }
  });
});

describe('LspFormattingHandler', () => {
  it('reads the document text from the index, not a separate provider', () => {
    const p = TestProject.fromFiles({ 'a.pss': 'component c {\n int a;\n}' });
    const edits = handleFormatting({ textDocument: { uri: p.uri('a.pss') }, options: FMT_OPTS }, p.index);

    expect(edits.length).toBeGreaterThan(0);
    expect(edits[0].newText).toContain('    int a;');
  });

  it('returns no edits for an unknown document', () => {
    const p = project();
    expect(handleFormatting({ textDocument: { uri: 'file:///ws/nope.pss' }, options: FMT_OPTS }, p.index)).toEqual([]);
  });

  it('range formatting returns edits too', () => {
    const p = TestProject.fromFiles({ 'a.pss': 'component c {\n int a;\n}' });
    const edits = handleRangeFormatting({
      textDocument: { uri: p.uri('a.pss') },
      range: p.wholeFileRange('a.pss'),
      options: FMT_OPTS,
    }, p.index);
    expect(edits.length).toBeGreaterThan(0);
  });
});

describe('LspWorkspaceSymbolHandler', () => {
  it('returns symbols whose locations point at real files', () => {
    const p = project();
    const symbols = handleWorkspaceSymbol({ query: 'data_s' }, p.index);

    expect(symbols.length).toBeGreaterThan(0);
    const target = symbols.find(s => s.name === 'data_s');
    expect(target).toBeDefined();
    // Regression guard: this used to be '' for every result, so Ctrl-T listed
    // symbols that could not be opened.
    expect(target!.location.uri).toBe(p.uri('pkg.pss'));
    expect(target!.kind).toBe(LspSymbolKind.Struct);
  });

  it('reports the enclosing container', () => {
    const p = project();
    const symbols = handleWorkspaceSymbol({ query: 'Entry' }, p.index);
    expect(symbols.find(s => s.name === 'Entry')?.containerName).toBe('top_c');
  });

  it('an empty query returns every symbol', () => {
    const p = project();
    expect(handleWorkspaceSymbol({ query: '' }, p.index).length).toBeGreaterThan(3);
  });
});

describe('LspActivityDiagramHandler', () => {
  it('returns a graph for a line inside an activity', () => {
    const p = project();
    const graph = handleActivityDiagram({ uri: p.uri('top.pss'), line: 4 }, p.index) as {
      nodes: unknown[];
    } | null;

    expect(graph).not.toBeNull();
    expect(Array.isArray(graph!.nodes)).toBe(true);
  });

  it('returns null for a file with no activity', () => {
    const p = project();
    expect(handleActivityDiagram({ uri: p.uri('pkg.pss'), line: 1 }, p.index)).toBeNull();
  });

  it('returns null for an unknown uri', () => {
    const p = project();
    expect(handleActivityDiagram({ uri: 'file:///ws/nope.pss', line: 0 }, p.index)).toBeNull();
  });
});

describe('hierarchy handlers', () => {
  it('prepareCallHierarchy returns an item or null', () => {
    const p = project();
    const item = handlePrepareCallHierarchy(at(p.uri('top.pss'), 3, 11), p.index);
    expect(item === null || Array.isArray(item) || typeof item === 'object').toBe(true);
  });

  it('prepareTypeHierarchy returns an item or null', () => {
    const p = project();
    const pos = p.position('top.pss', 'decl_c');
    const item = handlePrepareTypeHierarchy(at(p.uri('top.pss'), pos.line, pos.character), p.index);
    expect(item === null || Array.isArray(item) || typeof item === 'object').toBe(true);
  });
});
