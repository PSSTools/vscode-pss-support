import { bench, describe } from 'vitest';
import { PSSParserFacade } from '../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../src/core/parser/PSSASTBuilder';
import { SemanticAnalyzer } from '../src/core/analysis/SemanticAnalyzer';
import { WorkspaceIndex } from '../src/core/index/WorkspaceIndex';
import { GlobalScope } from '../src/core/ast/generated';

function generatePSSFile(fileIdx: number, lines: number): string {
  const parts: string[] = [`package bench_pkg_${fileIdx} {`];
  let lineCount = 1;
  let actionIdx = 0;

  while (lineCount < lines) {
    const actionName = `action_${fileIdx}_${actionIdx++}`;
    parts.push(`  action ${actionName} {`);
    lineCount++;

    for (let f = 0; f < 3 && lineCount < lines; f++) {
      parts.push(`    rand bit[32] field_${f};`);
      lineCount++;
    }

    if (lineCount < lines) {
      parts.push(`    constraint c { field_0 > 0; }`);
      lineCount++;
    }

    parts.push(`  }`);
    lineCount++;
  }

  parts.push('}');
  return parts.join('\n');
}

function buildScopes(fileCount: number, linesPerFile: number): GlobalScope[] {
  const parser = new PSSParserFacade();
  const scopes: GlobalScope[] = [];
  for (let i = 0; i < fileCount; i++) {
    const src = generatePSSFile(i, linesPerFile);
    const result = parser.parse(src, i + 1);
    const builder = new PSSASTBuilder(i + 1, result.tokens);
    const gs = builder.build(result.tree);
    gs.filename = `file_${i}.pss`;
    scopes.push(gs);
  }
  return scopes;
}

describe('Analysis Benchmarks', () => {
  const scopes10 = buildScopes(10, 1000);

  bench('full analysis - 10 files x 1K lines', () => {
    const analyzer = new SemanticAnalyzer();
    analyzer.analyze(scopes10);
  });

  bench('hover query (after analysis)', () => {
    const idx = new WorkspaceIndex();
    const parser = new PSSParserFacade();
    const src = generatePSSFile(0, 1000);
    idx.addFile('file:///test.pss', src);
    // Simulates hover at a known position
    idx.findSymbolAtPosition('file:///test.pss', { line: 2, character: 10 });
  });
});
