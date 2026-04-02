import {
  ScopeChild, Scope, TypeScope, Action, Component, Struct, Monitor,
  EnumDecl, GlobalScope, ExtendType, NamedScope, ActivityDecl,
} from '../ast/generated';
import { SourceRange } from '../types/SourceRange';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { getNodeName, walkScope } from '../ast/ASTUtils';
import { getReferences } from './ReferencesService';

export interface CodeLensItem {
  range: SourceRange;
  command: string;
  title: string;
  arguments?: unknown[];
}

/**
 * Produce code lenses for type declarations showing reference counts,
 * subtype counts, and inheritance info.
 */
export function getCodeLenses(
  uri: string,
  index: WorkspaceIndex,
): CodeLensItem[] {
  const ast = index.getAST(uri);
  if (!ast) return [];

  const lenses: CodeLensItem[] = [];

  for (const child of walkScope(ast)) {
    if (!(child instanceof TypeScope)) continue;
    const name = child.name?.id;
    if (!name) continue;
    const loc = child.location;
    if (loc.lineno < 0) continue;

    const range: SourceRange = {
      start: { line: loc.lineno - 1, character: loc.linepos },
      end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : name.length) },
    };

    // Reference count
    const refs = getReferences(uri, range.start, index, false);
    if (refs.length > 0) {
      lenses.push({
        range,
        command: 'editor.action.findReferences',
        title: `${refs.length} reference${refs.length === 1 ? '' : 's'}`,
        arguments: [uri, range.start],
      });
    }

    // Super type
    if (child.super_t) {
      const superName = child.super_t.elems.map(e => e.id?.id).join('::');
      lenses.push({
        range,
        command: 'editor.action.goToTypeDefinition',
        title: `extends ${superName}`,
      });
    }
  }

  // Activity diagram lenses
  for (const child of walkScope(ast)) {
    if (!(child instanceof ActivityDecl)) continue;
    const loc = child.location;
    if (loc.lineno < 0) continue;
    const range: SourceRange = {
      start: { line: loc.lineno - 1, character: loc.linepos },
      end: { line: loc.lineno - 1, character: loc.linepos + 8 },
    };
    lenses.push({
      range,
      command: 'pss.showActivityDiagram',
      title: 'View Activity Diagram',
      arguments: [uri, loc.lineno - 1],
    });
  }

  return lenses;
}
