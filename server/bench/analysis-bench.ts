import { bench, describe } from 'vitest';
import { parseSources } from '../test/helpers/ParseHelper.js';
import { SemanticAnalyzer } from '../src/core/analysis/SemanticAnalyzer.js';
import { WorkspaceIndex } from '../src/core/index/WorkspaceIndex.js';
import { GlobalScope } from '../src/core/ast/generated/index.js';

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
  const sources: Record<string, string> = {};
  for (let i = 0; i < fileCount; i++) {
    sources[`file_${i}.pss`] = generatePSSFile(i, linesPerFile);
  }
  const scopes = parseSources(sources).scopes;
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
    const src = generatePSSFile(0, 1000);
    idx.addFile('file:///test.pss', src);
    // Simulates hover at a known position
    idx.findSymbolAtPosition('file:///test.pss', { line: 2, character: 10 });
  });
});
