import { Diagnostic, DiagnosticSeverity } from '../../src/core/types/Diagnostic.js';
import { DocumentSymbol, SymbolKind } from '../../src/core/types/DocumentSymbol.js';
import { WorkspaceSymbol } from '../../src/core/types/WorkspaceSymbol.js';
import { CompletionResult, CompletionKind } from '../../src/core/types/CompletionResult.js';
import { SemanticToken } from '../../src/core/types/SemanticToken.js';
import { TOKEN_TYPES, TOKEN_MODIFIERS } from '../../src/core/services/SemanticTokenService.js';
import { FoldingRange } from '../../src/core/services/FoldingService.js';
import { InlayHint } from '../../src/core/services/InlayHintService.js';
import { CodeLensItem } from '../../src/core/services/CodeLensService.js';
import { CodeAction } from '../../src/core/services/CodeActionService.js';
import { DefinitionResult } from '../../src/core/types/DefinitionResult.js';

/**
 * Probes: render each user-facing surface as reviewable text.
 *
 * The point of a golden file is that a human can see the regression in the
 * diff. A flat array of token integers or a JSON blob of ranges fails that
 * test, so each renderer here produces a line-oriented form that reads like
 * what the user would see in the editor.
 *
 * All renderers report 1-based line and column numbers, matching the editor's
 * status bar and the diagnostics conventions of every compiler.
 */

const SEVERITY_NAMES: Record<number, string> = {
  [DiagnosticSeverity.Error]: 'error',
  [DiagnosticSeverity.Warning]: 'warning',
  [DiagnosticSeverity.Information]: 'info',
  [DiagnosticSeverity.Hint]: 'hint',
};

/** `line:col: severity[code]: message`, sorted by position. */
export function renderDiagnostics(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return '(no diagnostics)';

  return [...diagnostics]
    .sort((a, b) =>
      a.range.start.line - b.range.start.line ||
      a.range.start.character - b.range.start.character ||
      a.message.localeCompare(b.message))
    .map(d => {
      const line = d.range.start.line + 1;
      const col = d.range.start.character + 1;
      const severity = SEVERITY_NAMES[d.severity] ?? `severity${d.severity}`;
      const code = d.code ? `[${d.code}]` : '';
      return `${line}:${col}: ${severity}${code}: ${d.message}`;
    })
    .join('\n');
}

/** Indented outline tree, the shape the user sees in the Outline view. */
export function renderDocumentSymbols(symbols: DocumentSymbol[]): string {
  if (symbols.length === 0) return '(no symbols)';

  const lines: string[] = [];
  const walk = (nodes: DocumentSymbol[], depth: number): void => {
    for (const node of nodes) {
      const kind = SymbolKind[node.kind] ?? `kind${node.kind}`;
      const detail = node.detail ? ` -- ${node.detail}` : '';
      const at = `${node.selectionRange.start.line + 1}:${node.selectionRange.start.character + 1}`;
      lines.push(`${'  '.repeat(depth)}${kind} ${node.name} @${at}${detail}`);
      if (node.children) walk(node.children, depth + 1);
    }
  };
  walk(symbols, 0);
  return lines.join('\n');
}

/** Flat Ctrl-T list: `kind name (container) -> file:line:col`. */
export function renderWorkspaceSymbols(
  symbols: WorkspaceSymbol[],
  uriToName: (uri: string) => string,
): string {
  if (symbols.length === 0) return '(no symbols)';

  return symbols
    .map(s => {
      const kind = SymbolKind[s.kind] ?? `kind${s.kind}`;
      const container = s.containerName ? ` (${s.containerName})` : '';
      const at = `${uriToName(s.uri)}:${s.selectionRange.start.line + 1}:${s.selectionRange.start.character + 1}`;
      return `${kind} ${s.name}${container} -> ${at}`;
    })
    .sort()
    .join('\n');
}

/**
 * Semantic tokens as a source overlay: each source line followed by a line
 * marking which spans were tokenized and as what. A colouring regression is
 * visible in the diff instead of being buried in an integer array.
 */
export function renderSemanticTokens(source: string, tokens: SemanticToken[]): string {
  const lines = source.split('\n');
  const byLine = new Map<number, SemanticToken[]>();
  for (const token of tokens) {
    if (!byLine.has(token.line)) byLine.set(token.line, []);
    byLine.get(token.line)!.push(token);
  }

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const lineTokens = (byLine.get(i) ?? []).sort((a, b) => a.startChar - b.startChar);
    if (lineTokens.length === 0) continue;

    // Underline row, then one annotation per token.
    let underline = '';
    for (const token of lineTokens) {
      if (token.startChar < underline.length) continue;   // overlapping; skip marker
      underline += ' '.repeat(token.startChar - underline.length);
      underline += '~'.repeat(Math.max(1, token.length));
    }
    out.push(underline);
    for (const token of lineTokens) {
      const type = TOKEN_TYPES[token.tokenType] ?? `type${token.tokenType}`;
      const mods = decodeModifiers(token.tokenModifiers);
      const text = lines[i].substr(token.startChar, token.length);
      out.push(`  ^ ${token.startChar + 1}+${token.length} ${type}${mods} '${text}'`);
    }
  }
  return out.join('\n');
}

function decodeModifiers(bits: number): string {
  const names = TOKEN_MODIFIERS.filter((_, i) => (bits & (1 << i)) !== 0);
  return names.length > 0 ? `.${names.join('.')}` : '';
}

/** `kind label [insertText] -- detail`, in the order the service returned them. */
export function renderCompletions(items: CompletionResult[], limit = 60): string {
  if (items.length === 0) return '(no completions)';

  const shown = items.slice(0, limit).map(item => {
    const kind = CompletionKind[item.kind] ?? `kind${item.kind}`;
    const insert = item.insertText && item.insertText !== item.label
      ? ` [${item.insertText}]` : '';
    const detail = item.detail ? ` -- ${item.detail}` : '';
    return `${kind} ${item.label}${insert}${detail}`;
  });

  // Truncation must be visible; a silently capped list reads as complete.
  if (items.length > limit) {
    shown.push(`... ${items.length - limit} more (${items.length} total)`);
  }
  return shown.join('\n');
}

/** Folding ranges as `startLine-endLine [kind]`, 1-based inclusive. */
export function renderFoldingRanges(ranges: FoldingRange[]): string {
  if (ranges.length === 0) return '(no folding ranges)';
  return [...ranges]
    .sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine)
    .map(r => `${r.startLine + 1}-${r.endLine + 1}${r.kind ? ` [${r.kind}]` : ''}`)
    .join('\n');
}

/** Inlay hints as `line:col kind "label"`. */
export function renderInlayHints(hints: InlayHint[]): string {
  if (hints.length === 0) return '(no inlay hints)';
  return [...hints]
    .sort((a, b) => a.position.line - b.position.line || a.position.character - b.position.character)
    .map(h => `${h.position.line + 1}:${h.position.character + 1} ${h.kind} "${h.label}"`)
    .join('\n');
}

/** Code lenses as `line:col "title" -> command`. */
export function renderCodeLenses(lenses: CodeLensItem[]): string {
  if (lenses.length === 0) return '(no code lenses)';
  return [...lenses]
    .sort((a, b) => a.range.start.line - b.range.start.line ||
                    a.range.start.character - b.range.start.character)
    .map(l => `${l.range.start.line + 1}:${l.range.start.character + 1} "${l.title}" -> ${l.command}`)
    .join('\n');
}

/** Code actions with the edits they would make, per file. */
export function renderCodeActions(
  actions: CodeAction[],
  uriToName: (uri: string) => string,
): string {
  if (actions.length === 0) return '(no code actions)';

  const out: string[] = [];
  for (const action of actions) {
    out.push(`${action.kind}: ${action.title}`);
    for (const [uri, edits] of action.edits) {
      for (const edit of edits) {
        const from = `${edit.range.start.line + 1}:${edit.range.start.character + 1}`;
        const to = `${edit.range.end.line + 1}:${edit.range.end.character + 1}`;
        out.push(`  ${uriToName(uri)} ${from}-${to} := ${JSON.stringify(edit.newText)}`);
      }
    }
  }
  return out.join('\n');
}

/** Definition targets as `file:line:col-line:col`. */
export function renderDefinitions(
  results: DefinitionResult[],
  uriToName: (uri: string) => string,
): string {
  if (results.length === 0) return '(no definition)';
  return results
    .map(r =>
      `${uriToName(r.uri)}:${r.range.start.line + 1}:${r.range.start.character + 1}` +
      `-${r.range.end.line + 1}:${r.range.end.character + 1}`)
    .sort()
    .join('\n');
}

/** Hover markdown, with the covered range noted above it. */
export function renderHover(hover: { contents: string; range?: { start: { line: number; character: number } } } | null): string {
  if (!hover) return '(no hover)';
  const at = hover.range
    ? `@${hover.range.start.line + 1}:${hover.range.start.character + 1}`
    : '@(no range)';
  return `${at}\n---\n${hover.contents}`;
}
