import {
  ScopeChild,
  Scope,
  TypeScope,
  DataTypeUserDefined,
  TypeIdentifier,
  TemplateParamValueList,
  TemplateParamDeclList,
  ActivityActionHandleTraversal,
  GlobalScope,
  SymbolScope,
  SymbolTypeScope,
  RootSymbolScope,
} from '../ast/generated';
import { SourcePosition } from '../types/SourcePosition';
import { SourceRange } from '../types/SourceRange';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { walkScope, getNodeName } from '../ast/ASTUtils';

export interface InlayHint {
  position: SourcePosition;
  label: string;
  kind: 'type' | 'parameter';
  paddingLeft?: boolean;
  paddingRight?: boolean;
}

/**
 * Produce inlay hints for template parameter names at instantiation
 * sites and resolved action types on do-handle traversals.
 */
export function getInlayHints(
  uri: string,
  range: SourceRange,
  index: WorkspaceIndex,
): InlayHint[] {
  const ast = index.getAST(uri);
  if (!ast) return [];

  const hints: InlayHint[] = [];
  const analysis = index.getAnalysisResult();

  collectHints(ast, range, hints, index, analysis?.root ?? null);

  return hints;
}

function collectHints(
  scope: Scope,
  range: SourceRange,
  hints: InlayHint[],
  index: WorkspaceIndex,
  root: RootSymbolScope | null,
): void {
  for (const child of scope.children) {
    const loc = child.location;
    if (loc.lineno >= 0) {
      const line = loc.lineno - 1;
      // Only process nodes within the requested range
      if (line >= range.start.line && line <= range.end.line) {
        collectNodeHints(child, hints, index, root);
      }
    }

    if (child instanceof Scope) {
      collectHints(child, range, hints, index, root);
    }
  }
}

function collectNodeHints(
  node: ScopeChild,
  hints: InlayHint[],
  index: WorkspaceIndex,
  root: RootSymbolScope | null,
): void {
  // Template instantiation hints
  if (node instanceof DataTypeUserDefined && node.type_id) {
    addTemplateParamHints(node.type_id, hints, root);
  }

  // Activity handle traversal -- show resolved action type
  if (node instanceof ActivityActionHandleTraversal && node.target) {
    const hierId = node.target.hier_id;
    if (hierId && hierId.elems) {
      const lastElem = hierId.elems[hierId.elems.length - 1];
      if (lastElem?.id?.location && lastElem.id.location.lineno >= 0) {
        const loc = lastElem.id.location;
        hints.push({
          position: {
            line: loc.lineno - 1,
            character: loc.linepos + (loc.extent > 0 ? loc.extent : lastElem.id.id.length),
          },
          label: ': action',
          kind: 'type',
          paddingLeft: true,
        });
      }
    }
  }
}

function addTemplateParamHints(
  typeId: TypeIdentifier,
  hints: InlayHint[],
  root: RootSymbolScope | null,
): void {
  if (!root) return;

  for (const elem of typeId.elems) {
    if (elem.params && elem.params.values.length > 0 && elem.id?.id) {
      // Find the type declaration's template parameters
      const typeScope = findTypeScopeByName(elem.id.id, root);
      if (typeScope?.target instanceof TypeScope && typeScope.target.params) {
        const declParams = typeScope.target.params.params;
        for (let i = 0; i < elem.params.values.length && i < declParams.length; i++) {
          const paramName = declParams[i].name?.id;
          if (!paramName) continue;

          // Position the hint before the parameter value
          // (approximate -- we don't have exact positions for template values)
          const valueLoc = (elem.params.values[i] as any)?.location;
          if (valueLoc && valueLoc.lineno >= 0) {
            hints.push({
              position: { line: valueLoc.lineno - 1, character: valueLoc.linepos },
              label: `${paramName}=`,
              kind: 'parameter',
              paddingRight: true,
            });
          }
        }
      }
    }
  }
}

function findTypeScopeByName(name: string, scope: SymbolScope): SymbolTypeScope | null {
  if (scope.symtab.has(name)) {
    const idx = scope.symtab.get(name)!;
    const child = scope.children[idx];
    if (child instanceof SymbolTypeScope) return child;
  }

  for (const child of scope.children) {
    if (child instanceof SymbolScope) {
      const found = findTypeScopeByName(name, child);
      if (found) return found;
    }
  }

  return null;
}
