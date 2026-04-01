import {
  ScopeChild, Scope, Action, Field, FieldRef, FieldClaim,
  GlobalScope, TypeScope,
} from '../ast/generated';
import { walkScope, getNodeName } from '../ast/ASTUtils';

export interface ResourceBinding {
  actionName: string;
  resourceName: string;
  resourceType: string;
  kind: 'lock' | 'share' | 'input' | 'output';
  uri: string;
  line: number;
}

/**
 * Walk the index and collect lock/share relationships, input/output
 * bindings for resource/flow visualization.
 */
export function analyzeResources(
  asts: Map<string, GlobalScope>,
): ResourceBinding[] {
  const bindings: ResourceBinding[] = [];

  for (const [uri, ast] of asts) {
    collectBindings(ast, uri, bindings);
  }

  return bindings;
}

function collectBindings(ast: GlobalScope, uri: string, bindings: ResourceBinding[]): void {
  let currentAction: string | null = null;

  for (const child of walkScope(ast)) {
    if (child instanceof Action) {
      currentAction = child.name?.id ?? null;
    }

    if (!currentAction) continue;

    if (child instanceof FieldClaim) {
      const name = child.name?.id ?? '?';
      const typeName = child.type?.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
      bindings.push({
        actionName: currentAction,
        resourceName: name,
        resourceType: typeName,
        kind: child.is_lock ? 'lock' : 'share',
        uri,
        line: child.location.lineno >= 0 ? child.location.lineno - 1 : 0,
      });
    }

    if (child instanceof FieldRef) {
      const name = child.name?.id ?? '?';
      const typeName = child.type?.type_id?.elems.map(e => e.id?.id).join('::') ?? '?';
      bindings.push({
        actionName: currentAction,
        resourceName: name,
        resourceType: typeName,
        kind: child.is_input ? 'input' : 'output',
        uri,
        line: child.location.lineno >= 0 ? child.location.lineno - 1 : 0,
      });
    }
  }
}
