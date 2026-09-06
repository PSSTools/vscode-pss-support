import { expect } from 'vitest';
import { WorkspaceIndex } from '../../src/core/index/WorkspaceIndex';
import { WorkspaceLoader } from '../../src/core/index/WorkspaceLoader';
import { MemFileSystem } from '../../src/core/io/MemFileSystem';
import { nodeFileSystem } from '../../src/core/io/NodeFileSystem';
import { pathToUri, joinPath } from '../../src/core/io/UriUtils';
import { IConfiguration } from '../../src/core/io/IConfiguration';
import { SourcePosition } from '../../src/core/types/SourcePosition';
import { SourceRange } from '../../src/core/types/SourceRange';
import { Diagnostic } from '../../src/core/types/Diagnostic';
import { TextEdit } from '../../src/core/types/TextEdit';
import { DefinitionResult } from '../../src/core/types/DefinitionResult';
import { HoverResult } from '../../src/core/types/HoverResult';
import { CompletionResult } from '../../src/core/types/CompletionResult';
import { DocumentSymbol } from '../../src/core/types/DocumentSymbol';
import { WorkspaceSymbol } from '../../src/core/types/WorkspaceSymbol';
import { SemanticToken } from '../../src/core/types/SemanticToken';
import { GlobalScope } from '../../src/core/ast/generated';

import { getDefinition } from '../../src/core/services/DefinitionService';
import { getHover } from '../../src/core/services/HoverService';
import { getCompletions } from '../../src/core/services/CompletionService';
import { getReferences } from '../../src/core/services/ReferencesService';
import { getDocumentSymbols, getWorkspaceSymbols } from '../../src/core/services/SymbolService';
import { getSemanticTokens } from '../../src/core/services/SemanticTokenService';
import { getFoldingRanges, FoldingRange } from '../../src/core/services/FoldingService';
import { getInlayHints, InlayHint } from '../../src/core/services/InlayHintService';
import { getSignatureHelp } from '../../src/core/services/SignatureService';
import { getCodeLenses, CodeLensItem } from '../../src/core/services/CodeLensService';
import { getCodeActions, CodeAction } from '../../src/core/services/CodeActionService';
import { prepareRename, rename } from '../../src/core/services/RenameService';
import { formatDocument } from '../../src/core/services/FormatterService';
import { prepareCallHierarchy } from '../../src/core/services/CallHierarchyService';
import { prepareTypeHierarchy } from '../../src/core/services/TypeHierarchyService';

import { Marker, parseMarkers, positionToOffset } from './Markers';

/** Root every TestProject file lives under. */
const ROOT = '/ws';

export interface TestProjectOptions {
  /** Directory holding stdlib .pss sources; defaults to the bundled fallback. */
  stdlibDir?: string;
  /** Configuration handed to services that accept one. */
  config?: IConfiguration;
  /** Extra non-.pss files to place in the virtual filesystem (e.g. .pssconfig.json). */
  extraFiles?: Record<string, string>;
}

/**
 * A whole PSS project, loaded and analyzed entirely in memory.
 *
 * This is the harness for testing what populates the editor's visual surfaces
 * without an editor: the same WorkspaceLoader and WorkspaceIndex the language
 * server uses, over a MemFileSystem, queried through the same core services the
 * LSP handlers call.
 *
 * Files may carry markers (see Markers.ts); they are stripped before parsing
 * and their positions become queryable by name.
 */
export class TestProject {
  readonly index: WorkspaceIndex;
  readonly fs: MemFileSystem;
  private config?: IConfiguration;
  /** Cleaned text per file name. */
  private sources = new Map<string, string>();
  /** Markers per file name. */
  private fileMarkers = new Map<string, Marker[]>();

  private constructor(index: WorkspaceIndex, fs: MemFileSystem, config?: IConfiguration) {
    this.index = index;
    this.fs = fs;
    this.config = config;
  }

  /** Build a project from an in-line map of file name to (possibly marked) source. */
  static fromFiles(
    files: Record<string, string>,
    options: TestProjectOptions = {},
  ): TestProject {
    const fs = new MemFileSystem(options.extraFiles ?? {});
    const sources = new Map<string, string>();
    const markers = new Map<string, Marker[]>();

    for (const [name, raw] of Object.entries(files)) {
      const parsed = parseMarkers(raw);
      sources.set(name, parsed.text);
      markers.set(name, parsed.markers);
      fs.addFile(joinPath(ROOT, name), parsed.text);
    }

    const index = new WorkspaceIndex(options.stdlibDir, fs);
    for (const [name, text] of sources) {
      index.addFile(pathToUri(joinPath(ROOT, name)), text);
    }

    const project = new TestProject(index, fs, options.config);
    project.sources = sources;
    project.fileMarkers = markers;
    return project;
  }

  /**
   * Build a project from a directory under `server/test/fixtures/`.
   *
   * The fixture is copied off disk into memory, so edits made by a test never
   * touch the real tree and tests stay independent of each other.
   */
  static fromFixture(fixtureName: string, options: TestProjectOptions = {}): TestProject {
    const root = joinPath(__dirname, '../fixtures', fixtureName);
    if (!nodeFileSystem.isDirectory(root)) {
      throw new Error(`Fixture not found: ${root}`);
    }

    const files: Record<string, string> = {};
    const extra: Record<string, string> = { ...(options.extraFiles ?? {}) };

    const walk = (dir: string, prefix: string): void => {
      for (const entry of nodeFileSystem.readDir(dir).sort()) {
        const full = joinPath(dir, entry);
        const rel = prefix ? `${prefix}/${entry}` : entry;
        if (nodeFileSystem.isDirectory(full)) {
          walk(full, rel);
        } else if (entry.endsWith('.pss')) {
          files[rel] = nodeFileSystem.readFile(full) ?? '';
        } else {
          extra[joinPath(ROOT, rel)] = nodeFileSystem.readFile(full) ?? '';
        }
      }
    };
    walk(root, '');

    return TestProject.fromFiles(files, { ...options, extraFiles: extra });
  }

  /**
   * Build a project by running the real WorkspaceLoader over a virtual
   * filesystem, exercising discovery rather than bypassing it.
   */
  static async loaded(
    files: Record<string, string>,
    options: TestProjectOptions = {},
  ): Promise<TestProject> {
    const fs = new MemFileSystem();
    for (const [name, content] of Object.entries(files)) {
      fs.addFile(joinPath(ROOT, name), content);
    }
    const index = new WorkspaceIndex(options.stdlibDir, fs);
    await new WorkspaceLoader({ fs }).loadInto(index, [pathToUri(ROOT)]);

    const project = new TestProject(index, fs, options.config);
    for (const [name, content] of Object.entries(files)) {
      project.sources.set(name, content);
      project.fileMarkers.set(name, []);
    }
    return project;
  }

  // -- addressing ------------------------------------------------------

  /** The file:// URI for a project-relative file name. */
  uri(name: string): string {
    return pathToUri(joinPath(ROOT, name));
  }

  /** The marker-stripped source of a file. */
  text(name: string): string {
    const text = this.sources.get(name);
    if (text === undefined) throw new Error(`No such file in project: ${name}`);
    return text;
  }

  /** Every file name in the project. */
  fileNames(): string[] {
    return [...this.sources.keys()];
  }

  /** All markers, optionally filtered by kind, tagged with their file. */
  markers(kind?: string): Array<Marker & { file: string }> {
    const out: Array<Marker & { file: string }> = [];
    for (const [file, markers] of this.fileMarkers) {
      for (const marker of markers) {
        if (kind === undefined || marker.kind === kind) out.push({ ...marker, file });
      }
    }
    return out;
  }

  /**
   * Position of a named marker. `label` matches either the full label
   * ('def:s') or the bare name ('s'); omit it in a file with exactly one marker.
   */
  position(name: string, label?: string): SourcePosition {
    const markers = this.fileMarkers.get(name) ?? [];
    if (label === undefined) {
      if (markers.length !== 1) {
        throw new Error(
          `${name} has ${markers.length} markers; pass a label to disambiguate`,
        );
      }
      return markers[0].position;
    }
    const found = markers.find(m => m.label === label || m.name === label);
    if (!found) {
      const available = markers.map(m => m.label).join(', ') || '(none)';
      throw new Error(`No marker '${label}' in ${name}. Available: ${available}`);
    }
    return found.position;
  }

  /** The AST for a file, asserted present. */
  ast(name: string): GlobalScope {
    const ast = this.index.getAST(this.uri(name));
    if (!ast) throw new Error(`No AST for ${name}`);
    return ast;
  }

  // -- mutation --------------------------------------------------------

  /** Replace a file's contents and re-index. Markers in the new text are parsed. */
  edit(name: string, newSource: string): void {
    const parsed = parseMarkers(newSource);
    this.sources.set(name, parsed.text);
    this.fileMarkers.set(name, parsed.markers);
    this.fs.addFile(joinPath(ROOT, name), parsed.text);

    const uri = this.uri(name);
    if (this.index.getAST(uri)) {
      this.index.updateFile(uri, parsed.text);
    } else {
      this.index.addFile(uri, parsed.text);
    }
  }

  /**
   * Apply a service-produced edit map and re-index every touched file.
   * This is what turns "the service produced an edit" into "the edit was
   * correct" -- the result is a real project you can re-query.
   */
  applyEdits(edits: Map<string, TextEdit[]>): void {
    for (const [uri, fileEdits] of edits) {
      const name = this.nameForUri(uri);
      if (name === undefined) continue;
      this.edit(name, applyTextEdits(this.text(name), fileEdits));
    }
  }

  private nameForUri(uri: string): string | undefined {
    for (const name of this.sources.keys()) {
      if (this.uri(name) === uri) return name;
    }
    return undefined;
  }

  // -- surface queries -------------------------------------------------

  diagnostics(name: string): Diagnostic[] {
    return this.index.getDiagnostics(this.uri(name));
  }

  allDiagnostics(): Map<string, Diagnostic[]> {
    const out = new Map<string, Diagnostic[]>();
    for (const name of this.sources.keys()) {
      out.set(name, this.diagnostics(name));
    }
    return out;
  }

  definitionAt(name: string, label?: string): DefinitionResult[] {
    return getDefinition(this.uri(name), this.position(name, label), this.index);
  }

  hoverAt(name: string, label?: string): HoverResult | null {
    return getHover(this.uri(name), this.position(name, label), this.index) ?? null;
  }

  completionsAt(name: string, label?: string): CompletionResult[] {
    return getCompletions(
      this.uri(name),
      this.position(name, label),
      this.index,
      this.text(name),
      this.config,
    );
  }

  referencesAt(name: string, label?: string, includeDeclaration = true) {
    return getReferences(
      this.uri(name), this.position(name, label), this.index, includeDeclaration,
    );
  }

  signatureAt(name: string, label?: string) {
    return getSignatureHelp(this.uri(name), this.position(name, label), this.index);
  }

  documentSymbols(name: string): DocumentSymbol[] {
    return getDocumentSymbols(this.ast(name));
  }

  workspaceSymbols(query: string): WorkspaceSymbol[] {
    const asts = new Map<string, GlobalScope>();
    for (const n of this.sources.keys()) asts.set(this.uri(n), this.ast(n));
    return getWorkspaceSymbols(query, asts);
  }

  semanticTokens(name: string): SemanticToken[] {
    return getSemanticTokens(this.ast(name));
  }

  foldingRanges(name: string): FoldingRange[] {
    return getFoldingRanges(this.ast(name));
  }

  inlayHints(name: string, range?: SourceRange): InlayHint[] {
    return getInlayHints(this.uri(name), range ?? this.wholeFileRange(name), this.index);
  }

  codeLenses(name: string): CodeLensItem[] {
    return getCodeLenses(this.uri(name), this.index);
  }

  codeActionsAt(name: string, range?: SourceRange): CodeAction[] {
    const target = range ?? this.wholeFileRange(name);
    return getCodeActions(this.uri(name), target, this.diagnostics(name), this.index);
  }

  prepareRenameAt(name: string, label?: string) {
    return prepareRename(this.uri(name), this.position(name, label), this.index);
  }

  renameAt(name: string, newName: string, label?: string) {
    return rename(this.uri(name), this.position(name, label), newName, this.index);
  }

  format(name: string): TextEdit[] {
    return formatDocument(this.text(name), this.ast(name), this.config);
  }

  /** The formatted text of a file, with the edits already applied. */
  formatted(name: string): string {
    return applyTextEdits(this.text(name), this.format(name));
  }

  callHierarchyAt(name: string, label?: string) {
    return prepareCallHierarchy(this.uri(name), this.position(name, label), this.index);
  }

  typeHierarchyAt(name: string, label?: string) {
    return prepareTypeHierarchy(this.uri(name), this.position(name, label), this.index);
  }

  wholeFileRange(name: string): SourceRange {
    const lines = this.text(name).split('\n');
    return {
      start: { line: 0, character: 0 },
      end: { line: lines.length - 1, character: lines[lines.length - 1].length },
    };
  }

  // -- assertions ------------------------------------------------------

  /**
   * Every `ref:N` marker must resolve, via go-to-definition, to the location of
   * the `def:N` marker -- in any file in the project.
   *
   * One call covers cross-file symbol resolution for an entire fixture, so
   * adding a fixture adds coverage without adding test code.
   */
  assertGotoResolves(): void {
    const defs = new Map<string, { file: string; position: SourcePosition }>();
    for (const marker of this.markers('def')) {
      defs.set(marker.name, { file: marker.file, position: marker.position });
    }

    const refs = this.markers('ref');
    expect(refs.length, 'fixture declares no ref: markers').toBeGreaterThan(0);

    for (const ref of refs) {
      const expected = defs.get(ref.name);
      expect(expected, `ref:${ref.name} in ${ref.file} has no matching def:`).toBeDefined();

      const results = getDefinition(this.uri(ref.file), ref.position, this.index);
      const where = `ref:${ref.name} at ${ref.file}:${ref.position.line + 1}:${ref.position.character + 1}`;
      expect(results.length, `${where} resolved to nothing`).toBeGreaterThan(0);

      const target = { uri: this.uri(expected!.file), line: expected!.position.line };
      const matched = results.some(
        r => r.uri === target.uri && r.range.start.line === target.line,
      );
      expect(
        matched,
        `${where} resolved to ${JSON.stringify(results.map(r => ({ uri: r.uri, line: r.range.start.line })))}, ` +
        `expected ${expected!.file}:${expected!.position.line + 1}`,
      ).toBe(true);
    }
  }

  /**
   * Assert that every `ref-gap:N` marker still fails to resolve.
   *
   * These record capability gaps found by the harness rather than hiding them.
   * When someone implements the missing navigation this assertion fails, which
   * is the point: the failure message says to promote the marker to `ref:` so
   * the behaviour becomes a guarantee instead of a note.
   */
  assertKnownGaps(): void {
    for (const gap of this.markers('ref-gap')) {
      const results = getDefinition(this.uri(gap.file), gap.position, this.index);
      expect(
        results,
        `ref-gap:${gap.name} in ${gap.file} now resolves -- this navigation is ` +
        `supported, so promote the marker from 'ref-gap:' to 'ref:'`,
      ).toHaveLength(0);
    }
  }

  /** Assert the project analyzes with no error-severity diagnostics anywhere. */
  assertNoErrors(): void {
    const problems: string[] = [];
    for (const [name, diags] of this.allDiagnostics()) {
      for (const d of diags) {
        if (d.severity === 1 /* Error */) {
          problems.push(`${name}:${d.range.start.line + 1}: ${d.message}`);
        }
      }
    }
    expect(problems, `expected a clean project, got:\n${problems.join('\n')}`).toEqual([]);
  }
}

/**
 * Apply LSP-style text edits to a string.
 * Edits are applied back-to-front so earlier offsets stay valid.
 */
export function applyTextEdits(text: string, edits: TextEdit[]): string {
  const resolved = edits
    .map(e => ({
      start: positionToOffset(text, e.range.start),
      end: positionToOffset(text, e.range.end),
      newText: e.newText,
    }))
    .sort((a, b) => b.start - a.start);

  let out = text;
  for (const edit of resolved) {
    out = out.slice(0, edit.start) + edit.newText + out.slice(Math.min(edit.end, out.length));
  }
  return out;
}
