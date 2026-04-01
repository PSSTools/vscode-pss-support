// Context-sensitive PSS completion engine.

import {
  ScopeChild,
  Scope,
  TypeScope,
  NamedScope,
  NamedScopeChild,
  Action,
  Component,
  Struct,
  Field,
  FieldCompRef,
  FieldRef,
  FieldClaim,
  EnumDecl,
  EnumItem,
  FunctionDefinition,
  FunctionPrototype,
  ActivityDecl,
  PackageScope,
  AnnotationDecl,
  Monitor,
  TypedefDeclaration,
  GlobalScope,
  SymbolScope,
  SymbolTypeScope,
  SymbolEnumScope,
  SymbolFunctionScope,
  RootSymbolScope,
  ActionHandleField,
  DataTypeUserDefined,
  ExecBlock,
  ExecScope,
  TemplateParamDeclList,
  TemplateParamDecl,
  TemplateGenericTypeParamDecl,
  TemplateCategoryTypeParamDecl,
  TemplateValueParamDecl,
  enums,
  flags,
} from '../ast/generated';
import { CompletionResult, CompletionKind } from '../types/CompletionResult';
import { SourcePosition } from '../types/SourcePosition';
import { WorkspaceIndex } from '../index/WorkspaceIndex';
import { findNodeAtPosition, getNodeName } from '../ast/ASTUtils';
import { findSymbolScope } from '../analysis/SymbolLookup';
import { IConfiguration } from '../io/IConfiguration';

// ── Keyword lists ───────────────────────────────────────────────

const TOP_LEVEL_KEYWORDS = [
  'action', 'abstract', 'component', 'struct', 'buffer', 'resource',
  'stream', 'state', 'enum', 'package', 'import', 'extend', 'function',
  'typedef', 'annotation', 'monitor', 'covergroup', 'pure', 'const',
];

const ACTION_BODY_KEYWORDS = [
  'rand', 'constraint', 'activity', 'exec', 'input', 'output',
  'lock', 'share', 'action', 'override', 'static', 'const',
];

const CONSTRAINT_KEYWORDS = [
  'foreach', 'forall', 'if', 'else', 'unique', 'default', 'dist',
  'soft', 'implies', 'in',
];

const ACTIVITY_KEYWORDS = [
  'do', 'parallel', 'schedule', 'sequence', 'select', 'replicate',
  'repeat', 'foreach', 'if', 'else', 'match', 'bind', 'constraint',
  'atomic', 'symbol', 'super',
];

const EXEC_KEYWORDS = [
  'if', 'else', 'while', 'repeat', 'foreach', 'forall', 'match',
  'return', 'break', 'continue', 'yield',
];

const BUILTIN_TYPES: readonly string[] = [
  'bit', 'int', 'bool', 'string', 'chandle', 'void',
];

// ── Main entry point ────────────────────────────────────────────

/**
 * Main entry point. Determines cursor context and returns appropriate
 * completions. When `text` is provided the engine performs line-prefix
 * analysis to detect sub-contexts such as `do <target>`, `foo::`,
 * `field.`, `@`, `type<`, and inheritance `:`.
 */
export function getCompletions(
  uri: string,
  position: SourcePosition,
  index: WorkspaceIndex,
  text?: string,
  config?: IConfiguration,
): CompletionResult[] {
  const ast = index.getAST(uri);
  if (!ast) return getTopLevelCompletions(index);

  const node = findNodeAtPosition(ast, position);
  const context = detectContext(node, ast, position);
  const lineCtx = text ? parseLineContext(text, position) : null;

  // Line-prefix overrides take priority when detected.
  if (lineCtx) {
    // Template parameter context: inside `Type<...>`
    if (lineCtx.templateContext) {
      return getTemplateParamCompletions(
        lineCtx.templateContext.typeName,
        lineCtx.templateContext.paramIndex,
        lineCtx.partial,
        index,
      );
    }

    // Annotation context: after `@`
    if (lineCtx.afterAt) {
      return getAnnotationCompletions(lineCtx.partial, index);
    }

    // Member access: after `.`
    if (lineCtx.memberAccessPrefix) {
      return getMemberAccessCompletions(node, lineCtx.memberAccessPrefix, lineCtx.partial, index);
    }

    // Qualified path: after `::`
    if (lineCtx.qualifiedPrefix) {
      return getQualifiedPathCompletions(lineCtx.qualifiedPrefix, lineCtx.partial, index);
    }

    // Inheritance position: after `action X :` or `struct X :`
    if (lineCtx.inheritanceCategory !== null) {
      return getInheritanceCompletions(lineCtx.inheritanceCategory, lineCtx.partial, index);
    }

    // Import path context
    if (lineCtx.afterImport) {
      return getImportPathCompletions(index);
    }

    // `do` target context
    if (lineCtx.afterDo) {
      return getDoTargetCompletions(node, lineCtx.partial, index);
    }
  }

  switch (context) {
    case CompletionContext.TopLevel:
      return getTopLevelCompletions(index);
    case CompletionContext.ActionBody:
      return getActionBodyCompletions(index);
    case CompletionContext.StructBody:
      return getStructBodyCompletions(index);
    case CompletionContext.ComponentBody:
      return getComponentBodyCompletions(index);
    case CompletionContext.ConstraintBody:
      return getConstraintBodyCompletions(node, index);
    case CompletionContext.ActivityBody:
      return getActivityCompletions(node, index);
    case CompletionContext.ExecBody:
      return getExecBodyCompletions(node, index);
    case CompletionContext.TypePosition:
      return getTypeCompletions(index);
    case CompletionContext.ImportPath:
      return getImportPathCompletions(index);
    default:
      return getTopLevelCompletions(index);
  }
}

// ── Context enum ────────────────────────────────────────────────

enum CompletionContext {
  TopLevel,
  ActionBody,
  StructBody,
  ComponentBody,
  DoTarget,
  QualifiedPath,
  ConstraintBody,
  ActivityBody,
  ExecBody,
  TypePosition,
  ImportPath,
  Annotation,
}

// ── Line-prefix analysis ────────────────────────────────────────

interface TemplateContext {
  typeName: string;
  paramIndex: number;
}

interface LineContext {
  /** True when the cursor follows a `do` keyword. */
  afterDo: boolean;
  /** True when the cursor follows `import `. */
  afterImport: boolean;
  /** True when the cursor follows `@`. */
  afterAt: boolean;
  /** Segments before `::` when a qualified path is detected. */
  qualifiedPrefix: string[] | null;
  /** Segments before `.` when member access is detected. */
  memberAccessPrefix: string[] | null;
  /** Template context when inside `Type<...>`. */
  templateContext: TemplateContext | null;
  /** Type category for inheritance position (after `action X :`). */
  inheritanceCategory: string | null;
  /** Partial identifier being typed after the last separator. */
  partial: string;
}

/**
 * Extract contextual clues from the text on the current line up to
 * the cursor position. Lightweight text scan that works on
 * incomplete / broken code.
 */
export function parseLineContext(text: string, position: SourcePosition): LineContext {
  const lines = text.split('\n');
  const line = position.line < lines.length ? lines[position.line] : '';
  const before = line.slice(0, position.character);

  const trimmed = before.trimStart();

  const result: LineContext = {
    afterDo: false,
    afterImport: false,
    afterAt: false,
    qualifiedPrefix: null,
    memberAccessPrefix: null,
    templateContext: null,
    inheritanceCategory: null,
    partial: '',
  };

  // Detect `@` annotation context
  const atMatch = before.match(/@(\w*)$/);
  if (atMatch) {
    result.afterAt = true;
    result.partial = atMatch[1] || '';
    return result;
  }

  // Detect template parameter context: `TypeName<..., partial`
  // Scan backwards for unmatched `<`
  const templateCtx = detectTemplateContext(before);
  if (templateCtx) {
    result.templateContext = templateCtx;
    // Extract partial after last comma or `<`
    const afterSep = before.slice(before.lastIndexOf(templateCtx.paramIndex > 0 ? ',' : '<') + 1).trim();
    result.partial = afterSep.match(/(\w*)$/)?.[1] ?? '';
    return result;
  }

  // Detect inheritance position: `action X :` or `struct X :`
  const inheritMatch = trimmed.match(/^(action|abstract\s+action|component|struct|buffer|resource|stream|state)\s+\w+\s*:\s*(\w*)$/);
  if (inheritMatch) {
    let cat = inheritMatch[1];
    if (cat.startsWith('abstract')) cat = 'action';
    result.inheritanceCategory = cat;
    result.partial = inheritMatch[2] || '';
    return result;
  }

  // Detect `import` context
  const importMatch = trimmed.match(/^import\s+/);
  if (importMatch) {
    result.afterImport = true;
  }

  // Detect `do` context
  const doMatch = trimmed.match(/(?:^|.*\s)do\s+([\w:.]*)?$/);
  result.afterDo = !!doMatch;

  // Extract the expression token at the cursor (identifier chars + `:` + `.`)
  const exprMatch = before.match(/([\w.:]+)$/);
  const expr = exprMatch ? exprMatch[1] : '';

  // Member access: `foo.bar.`
  if (expr.includes('.')) {
    const dotParts = expr.split('.');
    result.partial = dotParts.pop() ?? '';
    result.memberAccessPrefix = dotParts.filter(p => p.length > 0);
    if (result.memberAccessPrefix.length === 0) result.memberAccessPrefix = null;
    return result;
  }

  // Qualified path: `foo::bar::`
  if (expr.includes('::')) {
    const parts = expr.split('::');
    result.partial = parts.pop() ?? '';
    result.qualifiedPrefix = parts.filter(p => p.length > 0);
    if (result.qualifiedPrefix.length === 0) result.qualifiedPrefix = null;
  } else {
    result.partial = expr;
  }

  return result;
}

/** Scan backwards for an unmatched `<` to detect template param context. */
function detectTemplateContext(before: string): TemplateContext | null {
  let depth = 0;
  let commaCount = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];
    if (ch === '>') { depth++; continue; }
    if (ch === '<') {
      if (depth > 0) { depth--; continue; }
      // Unmatched `<` found -- extract the type name before it
      const prefix = before.slice(0, i).trimEnd();
      const nameMatch = prefix.match(/(\w+)$/);
      if (!nameMatch) return null;
      return { typeName: nameMatch[1], paramIndex: commaCount };
    }
    if (ch === ',' && depth === 0) commaCount++;
  }
  return null;
}

// ── Do-target completions (scope-aware) ─────────────────────────

/**
 * After `do `: offer action types reachable from the enclosing
 * component context. Falls back to all workspace actions if the
 * enclosing context can't be determined.
 */
function getDoTargetCompletions(
  node: ScopeChild | null,
  partial: string,
  index: WorkspaceIndex,
): CompletionResult[] {
  const analysis = index.getAnalysisResult();
  if (!analysis) return [];

  const results: CompletionResult[] = [];

  // Try to find the enclosing Action and Component
  const enclosingAction = findEnclosingNode(node, Action) as Action | null;
  const enclosingComponent = findEnclosingNode(node, Component) as Component | null;

  if (enclosingComponent && analysis.root) {
    // Collect reachable component scopes: the enclosing component + comp-ref field targets
    const reachableCompScopes = collectReachableComponentScopes(
      enclosingAction, enclosingComponent, analysis.root,
    );

    if (reachableCompScopes.length > 0) {
      // Offer actions from reachable components
      for (const { compName, compScope } of reachableCompScopes) {
        for (const [name, idx] of compScope.symtab) {
          const child = compScope.children[idx];
          if (child instanceof SymbolTypeScope && child.target instanceof Action) {
            const isAbstract = child.target.is_abstract;
            results.push({
              label: name,
              kind: CompletionKind.Action,
              detail: isAbstract ? 'abstract action' : `action (${compName})`,
              sortText: (isAbstract ? '2_' : '0_') + name,
            });
          }
        }
      }

      // Also offer component types as `comp::action` path prefixes
      addComponentCompletionsFromIndex(results, index, '1_');

      return applyPartialFilter(results, partial);
    }
  }

  // Fallback: offer all actions + components from the workspace
  addActionCompletionsFromIndex(results, index, '0_');
  addComponentCompletionsFromIndex(results, index, '1_');

  return applyPartialFilter(results, partial);
}

/**
 * Walk up the AST parent chain to find the enclosing Action/Component
 * and collect the component scopes reachable via comp-ref fields.
 */
function collectReachableComponentScopes(
  action: Action | null,
  component: Component,
  root: RootSymbolScope,
): Array<{ compName: string; compScope: SymbolScope }> {
  const result: Array<{ compName: string; compScope: SymbolScope }> = [];

  // The enclosing component itself
  const compName = component.name?.id;
  if (compName) {
    const compScope = findSymbolScope(compName, root);
    if (compScope) result.push({ compName, compScope });
  }

  // Comp-ref fields declared in the enclosing action
  if (action) {
    for (const child of action.children) {
      if (child instanceof FieldCompRef && child.type) {
        const refTypeName = extractTypeName(child.type);
        if (refTypeName) {
          const refScope = findSymbolScope(refTypeName, root);
          if (refScope) result.push({ compName: refTypeName, compScope: refScope });
        }
      }
    }
  }

  return result;
}

// ── Member-access completions (after `.`) ───────────────────────

/**
 * Resolve the LHS of a dotted path and offer fields/methods of the
 * resolved type.
 */
function getMemberAccessCompletions(
  node: ScopeChild | null,
  memberPath: string[],
  partial: string,
  index: WorkspaceIndex,
): CompletionResult[] {
  const analysis = index.getAnalysisResult();
  if (!analysis) return [];

  // Find the enclosing type (Action, Struct, Component) to start resolution
  const enclosingType = findEnclosingNode(node, Action)
    ?? findEnclosingNode(node, Struct)
    ?? findEnclosingNode(node, Component);

  if (!enclosingType || !(enclosingType instanceof Scope)) return [];

  // Resolve the chain: each segment is a field name, resolve to its type
  let currentScope: Scope = enclosingType as Scope;
  for (const seg of memberPath) {
    const field = findFieldInScope(currentScope, seg);
    if (!field) return [];

    const fieldTypeName = getFieldTypeName(field);
    if (!fieldTypeName) return [];

    // Resolve through the symbol table
    const typeScope = findSymbolScope(fieldTypeName, analysis.root);
    if (!typeScope?.target) return [];
    if (!(typeScope.target instanceof Scope)) return [];

    currentScope = typeScope.target as Scope;
  }

  // Collect members from the resolved type
  const results: CompletionResult[] = [];
  collectFieldsFromType(currentScope, results, '0_');

  // Walk the super type chain for inherited members
  if (currentScope instanceof TypeScope) {
    walkSuperTypes(currentScope, analysis.root, (superScope) => {
      collectFieldsFromType(superScope, results, '1_');
    });
  }

  return applyPartialFilter(results, partial);
}

/** Find a field by name in a type's children. */
function findFieldInScope(scope: Scope, name: string): ScopeChild | null {
  for (const child of scope.children) {
    const childName = getNodeName(child);
    if (childName === name) {
      if (child instanceof Field || child instanceof FieldCompRef
        || child instanceof FieldRef || child instanceof FieldClaim
        || child instanceof ActionHandleField) {
        return child;
      }
    }
  }
  return null;
}

/** Extract the type name string from a field's declared type. */
function getFieldTypeName(field: ScopeChild): string | null {
  let dt: DataTypeUserDefined | null = null;
  if (field instanceof Field) {
    if (field.type instanceof DataTypeUserDefined) dt = field.type;
  } else if (field instanceof FieldCompRef) {
    dt = field.type;
  } else if (field instanceof FieldRef) {
    dt = field.type;
  } else if (field instanceof FieldClaim) {
    dt = field.type;
  } else if (field instanceof ActionHandleField) {
    if (field.type instanceof DataTypeUserDefined) dt = field.type;
  }
  if (!dt) return null;
  return extractTypeName(dt);
}

/** Extract a dotted/qualified name string from a DataTypeUserDefined. */
function extractTypeName(dt: DataTypeUserDefined): string | null {
  if (!dt.type_id || dt.type_id.elems.length === 0) return null;
  return dt.type_id.elems.map(e => e.id?.id ?? '').filter(s => s).join('::');
}

/** Collect field-level completions from a type's AST scope. */
function collectFieldsFromType(scope: Scope, results: CompletionResult[], sortPrefix: string): void {
  for (const child of scope.children) {
    const name = getNodeName(child);
    if (!name) continue;
    if (child instanceof Field) {
      results.push({ label: name, kind: CompletionKind.Field, detail: 'field', sortText: sortPrefix + name });
    } else if (child instanceof FieldCompRef) {
      results.push({ label: name, kind: CompletionKind.Component, detail: 'comp ref', sortText: sortPrefix + name });
    } else if (child instanceof FieldRef) {
      results.push({ label: name, kind: CompletionKind.Field, detail: child.is_input ? 'input' : 'output', sortText: sortPrefix + name });
    } else if (child instanceof FieldClaim) {
      results.push({ label: name, kind: CompletionKind.Field, detail: child.is_lock ? 'lock' : 'share', sortText: sortPrefix + name });
    } else if (child instanceof ActionHandleField) {
      results.push({ label: name, kind: CompletionKind.Action, detail: 'action handle', sortText: sortPrefix + name });
    } else if (child instanceof Action) {
      results.push({ label: name, kind: CompletionKind.Action, detail: child.is_abstract ? 'abstract action' : 'action', sortText: sortPrefix + name });
    }
  }
}

/** Walk up the super type chain and call `fn` for each super type scope. */
function walkSuperTypes(
  typeNode: TypeScope,
  root: RootSymbolScope,
  fn: (superScope: Scope) => void,
): void {
  // super_t is a TypeIdentifier (not DataTypeUserDefined)
  const superRef = typeNode.super_t;
  if (!superRef || !superRef.elems || superRef.elems.length === 0) return;
  const superName = superRef.elems.map(e => e.id?.id ?? '').filter(Boolean).join('::');
  if (!superName) return;

  const superSymScope = findSymbolScope(superName, root);
  if (!superSymScope?.target || !(superSymScope.target instanceof Scope)) return;

  fn(superSymScope.target as Scope);

  // Recurse for deeper inheritance
  if (superSymScope.target instanceof TypeScope) {
    walkSuperTypes(superSymScope.target as TypeScope, root, fn);
  }
}

// ── Template parameter completions ──────────────────────────────

function getTemplateParamCompletions(
  typeName: string,
  paramIndex: number,
  partial: string,
  index: WorkspaceIndex,
): CompletionResult[] {
  const analysis = index.getAnalysisResult();
  if (!analysis) return [];

  const typeScope = findSymbolScope(typeName, analysis.root);
  if (!typeScope) return getTypeCompletions(index); // fallback to all types

  // Find the template parameter declaration list on the AST target
  const target = typeScope.target as ScopeChild;
  const paramList: TemplateParamDeclList | null = (target as any)?.params ?? null;
  if (!paramList || paramIndex >= paramList.params.length) {
    return getTypeCompletions(index); // fallback
  }

  const param = paramList.params[paramIndex];
  const results: CompletionResult[] = [];

  if (param instanceof TemplateGenericTypeParamDecl) {
    // Unconstrained type parameter: offer all types
    for (const bt of BUILTIN_TYPES) {
      results.push({
        label: bt,
        kind: CompletionKind.Type,
        detail: `built-in type (param: ${param.name?.id ?? '?'})`,
        sortText: '0_' + bt,
      });
    }
    addTypeCompletionsFromIndex(results, index, '1_');
  } else if (param instanceof TemplateCategoryTypeParamDecl) {
    // Category-constrained: offer only matching types
    const category = param.category;
    addCategoryFilteredTypes(results, index, category, param.name?.id ?? '?');
  } else if (param instanceof TemplateValueParamDecl) {
    // Value parameter: offer const values in scope (limited)
    const paramName = param.name?.id ?? '?';
    results.push({
      label: '0',
      kind: CompletionKind.Keyword,
      detail: `value (param: ${paramName})`,
      sortText: '0_0',
    });
    // Offer any enum constants or const fields if we had them, but for
    // now just indicate this is a value position.
  }

  return applyPartialFilter(results, partial);
}

/** Offer types filtered by template category. */
function addCategoryFilteredTypes(
  results: CompletionResult[],
  index: WorkspaceIndex,
  category: enums.TypeCategory,
  paramName: string,
): void {
  const analysis = index.getAnalysisResult();
  if (!analysis) return;

  collectCategoryTypes(analysis.root, results, category, paramName);
}

function collectCategoryTypes(
  scope: SymbolScope,
  results: CompletionResult[],
  category: enums.TypeCategory,
  paramName: string,
): void {
  for (const [name, idx] of scope.symtab) {
    const child = scope.children[idx];
    if (child instanceof SymbolTypeScope) {
      const target = child.target;
      let matches = false;
      let detail = '';
      if (category === enums.TypeCategory.Action && target instanceof Action) {
        matches = true;
        detail = target.is_abstract ? 'abstract action' : 'action';
      } else if (category === enums.TypeCategory.Component && target instanceof Component) {
        matches = true;
        detail = 'component';
      } else if (category === enums.TypeCategory.Struct && target instanceof Struct) {
        matches = true;
        detail = enums.StructKind[target.kind]?.toLowerCase() ?? 'struct';
      } else if (
        (category === enums.TypeCategory.Buffer || category === enums.TypeCategory.Resource
          || category === enums.TypeCategory.State || category === enums.TypeCategory.Stream)
        && target instanceof Struct
      ) {
        const sk = enums.StructKind[target.kind]?.toLowerCase() ?? '';
        if (sk === enums.TypeCategory[category].toLowerCase()) {
          matches = true;
          detail = sk;
        }
      }
      if (matches) {
        results.push({
          label: name,
          kind: CompletionKind.Type,
          detail: `${detail} (param: ${paramName})`,
          sortText: '0_' + name,
        });
      }
      // Always recurse into type scope children (e.g. component containing actions)
      collectCategoryTypes(child, results, category, paramName);
    } else if (child instanceof SymbolScope && !(child instanceof RootSymbolScope)) {
      collectCategoryTypes(child, results, category, paramName);
    }
  }
}

// ── Annotation completions ──────────────────────────────────────

function getAnnotationCompletions(partial: string, index: WorkspaceIndex): CompletionResult[] {
  const analysis = index.getAnalysisResult();
  if (!analysis) return [];

  const results: CompletionResult[] = [];
  collectAnnotationsFromScope(analysis.root, results);

  return applyPartialFilter(results, partial);
}

function collectAnnotationsFromScope(scope: SymbolScope, results: CompletionResult[]): void {
  for (const [name, idx] of scope.symtab) {
    const child = scope.children[idx];
    if (child instanceof SymbolTypeScope && child.target instanceof AnnotationDecl) {
      results.push({
        label: name,
        kind: CompletionKind.Type,
        detail: 'annotation',
        sortText: '0_' + name,
      });
    } else if (child instanceof SymbolScope && !(child instanceof RootSymbolScope)) {
      collectAnnotationsFromScope(child, results);
    }
  }
}

// ── Inheritance completions ─────────────────────────────────────

function getInheritanceCompletions(
  category: string,
  partial: string,
  index: WorkspaceIndex,
): CompletionResult[] {
  const analysis = index.getAnalysisResult();
  if (!analysis) return [];

  const results: CompletionResult[] = [];
  collectInheritanceCandidates(analysis.root, results, category);

  return applyPartialFilter(results, partial);
}

function collectInheritanceCandidates(
  scope: SymbolScope,
  results: CompletionResult[],
  category: string,
): void {
  for (const [name, idx] of scope.symtab) {
    const child = scope.children[idx];
    if (child instanceof SymbolTypeScope) {
      const target = child.target;
      let matches = false;
      let detail = '';
      if (category === 'action' && target instanceof Action) {
        matches = true;
        detail = target.is_abstract ? 'abstract action' : 'action';
      } else if (category === 'component' && target instanceof Component) {
        matches = true;
        detail = 'component';
      } else if (target instanceof Struct) {
        const sk = enums.StructKind[target.kind]?.toLowerCase() ?? 'struct';
        if (sk === category || category === 'struct') {
          matches = true;
          detail = sk;
        }
      }
      if (matches) {
        results.push({
          label: name,
          kind: CompletionKind.Type,
          detail,
          sortText: '0_' + name,
        });
      }
      // Always recurse into type scope children
      collectInheritanceCandidates(child, results, category);
    } else if (child instanceof SymbolScope && !(child instanceof RootSymbolScope)) {
      collectInheritanceCandidates(child, results, category);
    }
  }
}

// ── AST-based context detection ─────────────────────────────────

function detectContext(
  node: ScopeChild | null,
  ast: GlobalScope,
  position: SourcePosition,
): CompletionContext {
  if (!node) return CompletionContext.TopLevel;

  let current: ScopeChild | null = node;
  while (current) {
    if (current instanceof ExecBlock || current instanceof ExecScope) return CompletionContext.ExecBody;
    if (current instanceof Action) return CompletionContext.ActionBody;
    if (current instanceof Struct) return CompletionContext.StructBody;
    if (current instanceof Component) return CompletionContext.ComponentBody;
    if (current instanceof ActivityDecl) return CompletionContext.ActivityBody;
    if (current instanceof PackageScope) return CompletionContext.TopLevel;

    current = current.parent;
  }

  return CompletionContext.TopLevel;
}

// ── Context-specific completion generators ──────────────────────

function getTopLevelCompletions(index: WorkspaceIndex): CompletionResult[] {
  const results: CompletionResult[] = [];

  for (const kw of TOP_LEVEL_KEYWORDS) {
    results.push({ label: kw, kind: CompletionKind.Keyword, detail: 'keyword', sortText: '1_' + kw });
  }

  addTypeCompletionsFromIndex(results, index, '2_');

  return results;
}

function getActionBodyCompletions(index: WorkspaceIndex): CompletionResult[] {
  const results: CompletionResult[] = [];

  for (const kw of ACTION_BODY_KEYWORDS) {
    results.push({ label: kw, kind: CompletionKind.Keyword, detail: 'keyword', sortText: '0_' + kw });
  }

  for (const bt of BUILTIN_TYPES) {
    results.push({ label: bt, kind: CompletionKind.Type, detail: 'built-in type', sortText: '1_' + bt });
  }

  addTypeCompletionsFromIndex(results, index, '2_');

  return results;
}

function getStructBodyCompletions(index: WorkspaceIndex): CompletionResult[] {
  const results: CompletionResult[] = [];

  const keywords = ['rand', 'constraint', 'const', 'static', 'function'];
  for (const kw of keywords) {
    results.push({ label: kw, kind: CompletionKind.Keyword, detail: 'keyword', sortText: '0_' + kw });
  }

  for (const bt of BUILTIN_TYPES) {
    results.push({ label: bt, kind: CompletionKind.Type, detail: 'built-in type', sortText: '1_' + bt });
  }

  addTypeCompletionsFromIndex(results, index, '2_');

  return results;
}

function getComponentBodyCompletions(index: WorkspaceIndex): CompletionResult[] {
  const results: CompletionResult[] = [];

  const keywords = [
    'action', 'abstract', 'struct', 'buffer', 'resource', 'stream',
    'state', 'pool', 'bind', 'override', 'exec', 'function',
  ];
  for (const kw of keywords) {
    results.push({ label: kw, kind: CompletionKind.Keyword, detail: 'keyword', sortText: '0_' + kw });
  }

  addTypeCompletionsFromIndex(results, index, '2_');

  return results;
}

function getConstraintBodyCompletions(
  node: ScopeChild | null,
  index: WorkspaceIndex,
): CompletionResult[] {
  const results: CompletionResult[] = [];

  for (const kw of CONSTRAINT_KEYWORDS) {
    results.push({ label: kw, kind: CompletionKind.Keyword, detail: 'keyword', sortText: '0_' + kw });
  }

  addFieldsFromScope(node, results);

  return results;
}

function getActivityCompletions(
  node: ScopeChild | null,
  index: WorkspaceIndex,
): CompletionResult[] {
  const results: CompletionResult[] = [];

  for (const kw of ACTIVITY_KEYWORDS) {
    results.push({ label: kw, kind: CompletionKind.Keyword, detail: 'keyword', sortText: '0_' + kw });
  }

  addActionCompletionsFromIndex(results, index, '1_');
  addComponentCompletionsFromIndex(results, index, '2_');

  return results;
}

function getExecBodyCompletions(node: ScopeChild | null, index: WorkspaceIndex): CompletionResult[] {
  const results: CompletionResult[] = [];

  for (const kw of EXEC_KEYWORDS) {
    results.push({ label: kw, kind: CompletionKind.Keyword, detail: 'keyword', sortText: '0_' + kw });
  }

  for (const bt of BUILTIN_TYPES) {
    results.push({ label: bt, kind: CompletionKind.Type, detail: 'built-in type', sortText: '1_' + bt });
  }

  // Fields from the enclosing type
  addFieldsFromScope(node, results);

  // Functions from workspace
  addFunctionsFromIndex(results, index, '3_');

  return results;
}

function getTypeCompletions(index: WorkspaceIndex): CompletionResult[] {
  const results: CompletionResult[] = [];

  for (const bt of BUILTIN_TYPES) {
    results.push({ label: bt, kind: CompletionKind.Type, detail: 'built-in type', sortText: '0_' + bt });
  }

  addTypeCompletionsFromIndex(results, index, '1_');

  return results;
}

function getImportPathCompletions(index: WorkspaceIndex): CompletionResult[] {
  const results: CompletionResult[] = [];
  const analysis = index.getAnalysisResult();
  if (!analysis) return results;

  for (const [name] of analysis.root.symtab) {
    results.push({ label: name, kind: CompletionKind.Package, detail: 'package' });
  }

  return results;
}

// ── Qualified-path completions ──────────────────────────────────

function getQualifiedPathCompletions(
  prefixParts: string[],
  partial: string,
  index: WorkspaceIndex,
): CompletionResult[] {
  const analysis = index.getAnalysisResult();
  if (!analysis) return [];

  let scope: SymbolScope = analysis.root;
  for (const seg of prefixParts) {
    const idx = scope.symtab.get(seg);
    if (idx === undefined) return [];
    const child = scope.children[idx];
    if (!(child instanceof SymbolScope)) return [];
    scope = child;
  }

  const results: CompletionResult[] = [];
  collectTypesFromScope(scope, results, '0_', /* recurse */ false);

  for (const [name, idx] of scope.symtab) {
    const child = scope.children[idx];
    if (child instanceof SymbolScope
        && !(child instanceof SymbolTypeScope)
        && !(child instanceof SymbolEnumScope)
        && !(child instanceof SymbolFunctionScope)
        && !(child instanceof RootSymbolScope)) {
      results.push({ label: name, kind: CompletionKind.Package, detail: 'package', sortText: '1_' + name });
    }
  }

  return applyPartialFilter(results, partial);
}

// ── Index scanning helpers ──────────────────────────────────────

function addTypeCompletionsFromIndex(
  results: CompletionResult[],
  index: WorkspaceIndex,
  sortPrefix: string,
): void {
  const analysis = index.getAnalysisResult();
  if (!analysis) return;

  collectTypesFromScope(analysis.root, results, sortPrefix);
}

function collectTypesFromScope(
  scope: SymbolScope,
  results: CompletionResult[],
  sortPrefix: string,
  recurse: boolean = true,
): void {
  for (const [name, idx] of scope.symtab) {
    const child = scope.children[idx];
    if (child instanceof SymbolTypeScope) {
      const target = child.target;
      let kind = CompletionKind.Type;
      let detail = 'type';

      if (target instanceof Action) {
        kind = CompletionKind.Action;
        detail = target.is_abstract ? 'abstract action' : 'action';
      } else if (target instanceof Component) {
        kind = CompletionKind.Component;
        detail = 'component';
      } else if (target instanceof Struct) {
        const sk = enums.StructKind[target.kind]?.toLowerCase() ?? 'struct';
        kind = CompletionKind.Struct;
        detail = sk;
      } else if (target instanceof Monitor) {
        kind = CompletionKind.Type;
        detail = 'monitor';
      } else if (target instanceof AnnotationDecl) {
        kind = CompletionKind.Type;
        detail = 'annotation';
      }

      results.push({
        label: name,
        kind,
        detail,
        documentation: (target as ScopeChild)?.docstring?.trim() || undefined,
        sortText: sortPrefix + name,
      });
    } else if (child instanceof SymbolEnumScope) {
      results.push({ label: name, kind: CompletionKind.Enum, detail: 'enum', sortText: sortPrefix + name });
    } else if (child instanceof SymbolFunctionScope) {
      results.push({ label: name, kind: CompletionKind.Function, detail: 'function', sortText: sortPrefix + name });
    } else if (recurse && child instanceof SymbolScope && !(child instanceof RootSymbolScope)) {
      collectTypesFromScope(child, results, sortPrefix);
    }
  }
}

function addActionCompletionsFromIndex(
  results: CompletionResult[],
  index: WorkspaceIndex,
  sortPrefix: string = '1_',
): void {
  const analysis = index.getAnalysisResult();
  if (!analysis) return;
  collectActionsFromScope(analysis.root, results, sortPrefix);
}

function addComponentCompletionsFromIndex(
  results: CompletionResult[],
  index: WorkspaceIndex,
  sortPrefix: string = '2_',
): void {
  const analysis = index.getAnalysisResult();
  if (!analysis) return;
  collectComponentsFromScope(analysis.root, results, sortPrefix);
}

function addFunctionsFromIndex(
  results: CompletionResult[],
  index: WorkspaceIndex,
  sortPrefix: string = '2_',
): void {
  const analysis = index.getAnalysisResult();
  if (!analysis) return;
  collectFunctionsFromScope(analysis.root, results, sortPrefix);
}

function collectComponentsFromScope(
  scope: SymbolScope,
  results: CompletionResult[],
  sortPrefix: string,
): void {
  for (const [name, idx] of scope.symtab) {
    const child = scope.children[idx];
    if (child instanceof SymbolTypeScope && child.target instanceof Component) {
      results.push({ label: name, kind: CompletionKind.Component, detail: 'component', sortText: sortPrefix + name });
    } else if (child instanceof SymbolScope && !(child instanceof RootSymbolScope)) {
      collectComponentsFromScope(child, results, sortPrefix);
    }
  }
}

function collectActionsFromScope(
  scope: SymbolScope,
  results: CompletionResult[],
  sortPrefix: string,
): void {
  for (const [name, idx] of scope.symtab) {
    const child = scope.children[idx];
    if (child instanceof SymbolTypeScope && child.target instanceof Action) {
      results.push({
        label: name,
        kind: CompletionKind.Action,
        detail: child.target.is_abstract ? 'abstract action' : 'action',
        sortText: sortPrefix + name,
      });
    } else if (child instanceof SymbolScope) {
      collectActionsFromScope(child, results, sortPrefix);
    }
  }
}

function collectFunctionsFromScope(
  scope: SymbolScope,
  results: CompletionResult[],
  sortPrefix: string,
): void {
  for (const [name, idx] of scope.symtab) {
    const child = scope.children[idx];
    if (child instanceof SymbolFunctionScope) {
      results.push({ label: name, kind: CompletionKind.Function, detail: 'function', sortText: sortPrefix + name });
    } else if (child instanceof SymbolScope && !(child instanceof RootSymbolScope)) {
      collectFunctionsFromScope(child, results, sortPrefix);
    }
  }
}

// ── Shared helpers ──────────────────────────────────────────────

function addFieldsFromScope(
  node: ScopeChild | null,
  results: CompletionResult[],
): void {
  let current: ScopeChild | null = node;
  while (current) {
    if (current instanceof TypeScope && current instanceof Scope) {
      collectFieldsFromType(current as Scope, results, '2_');
      break;
    }
    current = current.parent;
  }
}

/** Walk up `node.parent` to find the nearest ancestor of the given class. */
function findEnclosingNode(node: ScopeChild | null, cls: Function): ScopeChild | null {
  let current: ScopeChild | null = node;
  while (current) {
    if (current instanceof (cls as any)) return current;
    current = current.parent;
  }
  return null;
}

/** Filter results by a partial identifier prefix. */
function applyPartialFilter(results: CompletionResult[], partial: string): CompletionResult[] {
  if (!partial) return results;
  const lp = partial.toLowerCase();
  return results.filter(r => r.label.toLowerCase().startsWith(lp));
}

/**
 * Resolve additional documentation for a completion item.
 */
export function resolveCompletionItem(
  item: CompletionResult,
  index: WorkspaceIndex,
): CompletionResult {
  if (item.documentation) return item;

  const scope = index.findType(item.label);
  if (scope?.target) {
    const target = scope.target as ScopeChild;
    if (target.docstring) {
      return { ...item, documentation: target.docstring.trim() };
    }
  }

  return item;
}
