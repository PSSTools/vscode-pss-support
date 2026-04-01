#!/usr/bin/env node
/**
 * pss-check: CLI tool for checking PSS files.
 * Discovers files via glob, parses, analyzes, and prints diagnostics
 * in GCC-compatible format: file:line:col: severity: message
 *
 * Imports only from server/src/core/ -- no LSP/VSCode dependencies.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';
import { PSSParserFacade } from '../core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../core/parser/PSSASTBuilder';
import { SemanticAnalyzer } from '../core/analysis/SemanticAnalyzer';
import { GlobalScope } from '../core/ast/generated';
import { Diagnostic, DiagnosticSeverity } from '../core/types/Diagnostic';

function discoverFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverFiles(fullPath));
    } else if (entry.name.endsWith('.pss')) {
      files.push(fullPath);
    }
  }
  return files;
}

function severityString(sev: DiagnosticSeverity): string {
  switch (sev) {
    case DiagnosticSeverity.Error: return 'error';
    case DiagnosticSeverity.Warning: return 'warning';
    case DiagnosticSeverity.Information: return 'info';
    case DiagnosticSeverity.Hint: return 'hint';
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const target = args[0] || '.';
  const rootDir = resolve(target);

  let files: string[];
  try {
    const stat = statSync(rootDir);
    if (stat.isDirectory()) {
      files = discoverFiles(rootDir);
    } else {
      files = [rootDir];
    }
  } catch {
    console.error(`Error: cannot access '${rootDir}'`);
    process.exit(2);
  }

  if (files.length === 0) {
    console.log('No .pss files found.');
    process.exit(0);
  }

  const parser = new PSSParserFacade();
  const scopes: GlobalScope[] = [];
  const fileMap = new Map<number, string>();
  let fileId = 1;
  let hasErrors = false;

  // Parse all files
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const result = parser.parse(content, fileId);
    const builder = new PSSASTBuilder(fileId, result.tokens);
    const gs = builder.build(result.tree);
    gs.filename = file;
    scopes.push(gs);
    fileMap.set(fileId, file);

    // Report syntax errors
    for (const diag of result.errors) {
      const rel = relative(process.cwd(), file);
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      console.log(`${rel}:${line}:${col}: ${severityString(diag.severity)}: ${diag.message}`);
      if (diag.severity === DiagnosticSeverity.Error) hasErrors = true;
    }

    fileId++;
  }

  // Semantic analysis
  const analyzer = new SemanticAnalyzer();
  const result = analyzer.analyze(scopes);

  for (const [fid, diags] of result.diagnostics) {
    const file = fileMap.get(fid) ?? '<unknown>';
    const rel = relative(process.cwd(), file);
    for (const diag of diags) {
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      console.log(`${rel}:${line}:${col}: ${severityString(diag.severity)}: ${diag.message}`);
      if (diag.severity === DiagnosticSeverity.Error) hasErrors = true;
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main();
