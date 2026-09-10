#!/usr/bin/env node
/**
 * pss-check: CLI tool for checking PSS files.
 * Discovers files, indexes them, and prints diagnostics in GCC-compatible
 * format: file:line:col: severity: message
 *
 * Runs the same WorkspaceIndex + WorkspaceLoader pipeline the language server
 * uses, so what this prints is by construction what the editor would show.
 * Imports only from server/src/core/ -- no LSP/VSCode dependencies.
 */
import { relative } from 'path';
import { WorkspaceIndex } from '../core/index/WorkspaceIndex.js';
import { WorkspaceLoader } from '../core/index/WorkspaceLoader.js';
import { nodeFileSystem } from '../core/io/NodeFileSystem.js';
import { pathToUri, uriToPath } from '../core/io/UriUtils.js';
import { DiagnosticSeverity } from '../core/types/Diagnostic.js';

function severityString(sev: DiagnosticSeverity): string {
  switch (sev) {
    case DiagnosticSeverity.Error: return 'error';
    case DiagnosticSeverity.Warning: return 'warning';
    case DiagnosticSeverity.Information: return 'info';
    case DiagnosticSeverity.Hint: return 'hint';
  }
}

export interface CheckResult {
  lines: string[];
  hasErrors: boolean;
  fileCount: number;
}

/**
 * Analyze a file or directory and render diagnostics as text lines.
 * Separated from `main` so tests can assert on the output without spawning a
 * process or capturing stdout.
 */
export async function check(target: string, cwd: string = process.cwd()): Promise<CheckResult> {
  const index = new WorkspaceIndex();
  const loader = new WorkspaceLoader();

  let uris: string[];
  if (nodeFileSystem.isDirectory(target)) {
    uris = await loader.loadInto(index, [pathToUri(target)]);
  } else {
    const content = nodeFileSystem.readFile(target);
    if (content === undefined) throw new Error(`cannot access '${target}'`);
    const uri = pathToUri(target);
    index.addFile(uri, content);
    uris = [uri];
  }

  const lines: string[] = [];
  let hasErrors = false;

  for (const uri of uris.slice().sort()) {
    const rel = relative(cwd, uriToPath(uri));
    for (const diag of index.getDiagnostics(uri)) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      lines.push(`${rel}:${line}:${col}: ${severityString(diag.severity)}: ${diag.message}`);
      if (diag.severity === DiagnosticSeverity.Error) hasErrors = true;
    }
  }

  return { lines, hasErrors, fileCount: uris.length };
}

async function main(): Promise<void> {
  const target = process.argv[2] || '.';

  let result: CheckResult;
  try {
    result = await check(target);
  } catch (e: unknown) {
    console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
    return;
  }

  if (result.fileCount === 0) {
    console.log('No .pss files found.');
    process.exit(0);
  }

  for (const line of result.lines) console.log(line);
  process.exit(result.hasErrors ? 1 : 0);
}

// Only run when invoked directly, so the module can be imported by tests.
if (require.main === module) {
  void main();
}
