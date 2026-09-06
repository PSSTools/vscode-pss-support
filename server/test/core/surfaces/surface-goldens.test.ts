import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { TestProject } from '../../helpers/TestProject';
import {
  renderDiagnostics,
  renderDocumentSymbols,
  renderWorkspaceSymbols,
  renderSemanticTokens,
  renderFoldingRanges,
  renderInlayHints,
  renderCodeLenses,
  renderCompletions,
  renderDefinitions,
  renderHover,
} from '../../helpers/Probes';

/**
 * Golden-file coverage of every surface whose output a user reads directly.
 *
 * Update with `npx vitest run -u` after reviewing the diff. The renderers in
 * Probes.ts are deliberately line-oriented so that reviewing the diff is the
 * same act as reviewing the behaviour.
 */

const GOLDEN_DIR = join(__dirname, '__goldens__');
const golden = (name: string) => join(GOLDEN_DIR, `${name}.txt`);

/** Map a project URI back to a short file name so goldens stay path-independent. */
function namer(p: TestProject) {
  return (uri: string) => p.fileNames().find(n => p.uri(n) === uri) ?? uri;
}

describe('surface goldens: cross-package fixture', () => {
  const project = () => TestProject.fromFixture('cross-package');

  it('outline for a component with actions', async () => {
    await expect(renderDocumentSymbols(project().documentSymbols('dev_comp.pss')))
      .toMatchFileSnapshot(golden('outline-dev_comp'));
  });

  it('outline for a package of types', async () => {
    await expect(renderDocumentSymbols(project().documentSymbols('types_pkg.pss')))
      .toMatchFileSnapshot(golden('outline-types_pkg'));
  });

  it('workspace symbols for an empty query list every symbol with its file', async () => {
    const p = project();
    await expect(renderWorkspaceSymbols(p.workspaceSymbols(''), namer(p)))
      .toMatchFileSnapshot(golden('workspace-symbols-all'));
  });

  it('semantic token overlay', async () => {
    const p = project();
    await expect(renderSemanticTokens(p.text('types_pkg.pss'), p.semanticTokens('types_pkg.pss')))
      .toMatchFileSnapshot(golden('semantic-tokens-types_pkg'));
  });

  it('folding ranges', async () => {
    await expect(renderFoldingRanges(project().foldingRanges('dev_comp.pss')))
      .toMatchFileSnapshot(golden('folding-dev_comp'));
  });

  it('code lenses', async () => {
    await expect(renderCodeLenses(project().codeLenses('types_pkg.pss')))
      .toMatchFileSnapshot(golden('codelens-types_pkg'));
  });

  it('inlay hints', async () => {
    await expect(renderInlayHints(project().inlayHints('pss_top.pss')))
      .toMatchFileSnapshot(golden('inlay-pss_top'));
  });

  it('a clean project produces no diagnostics', async () => {
    const p = project();
    for (const name of p.fileNames()) {
      expect(renderDiagnostics(p.diagnostics(name)), name).toBe('(no diagnostics)');
    }
  });
});

describe('surface goldens: diagnostics', () => {
  it('renders undefined types and unresolved imports', async () => {
    const p = TestProject.fromFiles({
      'broken.pss': [
        'import no_such_pkg::*;',
        '',
        'component top {',
        '    missing_t   field_a;',
        '    another_missing_t field_b;',
        '}',
      ].join('\n'),
    });
    await expect(renderDiagnostics(p.diagnostics('broken.pss')))
      .toMatchFileSnapshot(golden('diagnostics-undefined'));
  });

  it('renders syntax errors', async () => {
    const p = TestProject.fromFiles({
      'syntax.pss': 'component top {\n    int a\n',
    });
    await expect(renderDiagnostics(p.diagnostics('syntax.pss')))
      .toMatchFileSnapshot(golden('diagnostics-syntax'));
  });
});

describe('surface goldens: hover and completion', () => {
  it('hover over a component declaration', async () => {
    const p = TestProject.fromFiles({
      'a.pss': [
        '/** A device component. */',
        'component /*[c]*/dev_c {',
        '    int a;',
        '}',
      ].join('\n'),
    });
    await expect(renderHover(p.hoverAt('a.pss', 'c')))
      .toMatchFileSnapshot(golden('hover-component'));
  });

  it('top-level completions', async () => {
    const p = TestProject.fromFiles({ 'a.pss': '|' });
    await expect(renderCompletions(p.completionsAt('a.pss')))
      .toMatchFileSnapshot(golden('completions-toplevel'));
  });

  it('completions after a package qualifier', async () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package p { struct s1 { } struct s2 { } enum e { A, B } }',
      'top.pss': 'component top {\n    p::|\n}',
    });
    await expect(renderCompletions(p.completionsAt('top.pss')))
      .toMatchFileSnapshot(golden('completions-qualified'));
  });
});

describe('surface goldens: definitions', () => {
  it('cross-file type reference', async () => {
    const p = TestProject.fromFiles({
      'pkg.pss': 'package p { struct my_s { } }',
      'top.pss': 'import p::*;\ncomponent top {\n    my|_s x;\n}',
    });
    await expect(renderDefinitions(p.definitionAt('top.pss'), namer(p)))
      .toMatchFileSnapshot(golden('definition-cross-file'));
  });
});
