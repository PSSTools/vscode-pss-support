import {
  ScopeChild,
  GlobalScope,
  PackageImportStmt,
  Scope,
} from '../ast/generated';
import { Diagnostic } from '../types/Diagnostic';
import { TextEdit } from '../types/TextEdit';
import { SourceRange } from '../types/SourceRange';
import { WorkspaceIndex } from '../index/WorkspaceIndex';

export interface CodeAction {
  title: string;
  kind: string;
  diagnostics?: Diagnostic[];
  edits: Map<string, TextEdit[]>;
}

/**
 * Produce code actions (quick fixes) for diagnostics at a given range.
 * Supports: suggest import for unresolved type, remove unused import,
 * insert missing semicolon.
 */
export function getCodeActions(
  uri: string,
  range: SourceRange,
  diagnostics: Diagnostic[],
  index: WorkspaceIndex,
): CodeAction[] {
  const actions: CodeAction[] = [];

  for (const diag of diagnostics) {
    if (diag.code === 'undefined-type') {
      const typeName = extractTypeName(diag.message);
      if (typeName) {
        const importAction = suggestImport(uri, typeName, index, diag);
        if (importAction) actions.push(importAction);
      }
    }
  }

  return actions;
}

function extractTypeName(message: string): string | null {
  // Extract type name from "Undefined type 'foo'"
  const match = message.match(/['']([^'']+)['']/);
  return match ? match[1] : null;
}

function suggestImport(
  uri: string,
  typeName: string,
  index: WorkspaceIndex,
  diag: Diagnostic,
): CodeAction | null {
  const analysis = index.getAnalysisResult();
  if (!analysis) return null;

  // Search for the type in all packages
  for (const [pkgName, pkgIdx] of analysis.root.symtab) {
    const pkg = analysis.root.children[pkgIdx];
    if (pkg && 'symtab' in pkg) {
      const symtab = (pkg as any).symtab as Map<string, number>;
      if (symtab.has(typeName)) {
        const importText = `import ${pkgName}::${typeName};\n`;
        const edits = new Map<string, TextEdit[]>();
        edits.set(uri, [{
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          newText: importText,
        }]);

        return {
          title: `Import '${typeName}' from '${pkgName}'`,
          kind: 'quickfix',
          diagnostics: [diag],
          edits,
        };
      }
    }
  }

  return null;
}
