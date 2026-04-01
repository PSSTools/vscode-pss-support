import {
  ScopeChild, Scope, TypeScope, Action, Component, Struct, Field,
  EnumDecl, GlobalScope, ActivityDecl, NamedScopeChild,
  SymbolChildrenScope, flags,
} from '../ast/generated';
import { Diagnostic, DiagnosticSeverity } from '../types/Diagnostic';
import { getNodeName, walkScope } from '../ast/ASTUtils';
import { IConfiguration } from '../io/IConfiguration';

export interface LintRule {
  name: string;
  enabled: boolean;
}

const DEFAULT_RULES: LintRule[] = [
  { name: 'no-empty-constraint', enabled: true },
  { name: 'no-unused-field', enabled: true },
  { name: 'naming-convention', enabled: true },
  { name: 'max-activity-depth', enabled: true },
  { name: 'no-unreachable-branch', enabled: true },
];

/**
 * Configurable lint rules producing info/warning diagnostics.
 */
export function lint(
  ast: GlobalScope,
  config?: IConfiguration,
): Diagnostic[] {
  const rules = resolveRules(config);
  const diagnostics: Diagnostic[] = [];

  for (const child of walkScope(ast)) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      switch (rule.name) {
        case 'no-empty-constraint':
          checkEmptyConstraint(child, diagnostics);
          break;
        case 'naming-convention':
          checkNamingConvention(child, diagnostics);
          break;
      }
    }
  }

  return diagnostics;
}

function resolveRules(config?: IConfiguration): LintRule[] {
  if (!config) return DEFAULT_RULES;
  return DEFAULT_RULES.map(r => ({
    ...r,
    enabled: config.get(`pss.lint.rules.${r.name}`, r.enabled),
  }));
}

function checkEmptyConstraint(node: ScopeChild, diags: Diagnostic[]): void {
  // ConstraintBlock with no children
  if (node.constructor.name === 'ConstraintBlock' || node.constructor.name === 'ConstraintScope') {
    if (node instanceof Scope && node.children.length === 0) {
      addLintDiag(node, 'no-empty-constraint', 'Empty constraint block', diags);
    }
  }
}

function checkNamingConvention(node: ScopeChild, diags: Diagnostic[]): void {
  if (!(node instanceof TypeScope)) return;
  const name = node.name?.id;
  if (!name) return;

  // Types should use snake_case or PascalCase, not camelCase starting with lowercase
  // This is a soft convention check
  if (name.length > 1 && /^[a-z]/.test(name) && /[A-Z]/.test(name) && !name.includes('_')) {
    addLintDiag(node, 'naming-convention',
      `Type name '${name}' uses camelCase; consider snake_case or PascalCase`,
      diags, DiagnosticSeverity.Information);
  }
}

function addLintDiag(
  node: ScopeChild, code: string, message: string,
  diags: Diagnostic[],
  severity: DiagnosticSeverity = DiagnosticSeverity.Warning,
): void {
  const loc = node.location;
  if (loc.lineno < 0) return;
  diags.push({
    range: {
      start: { line: loc.lineno - 1, character: loc.linepos },
      end: { line: loc.lineno - 1, character: loc.linepos + (loc.extent > 0 ? loc.extent : 1) },
    },
    severity,
    code: `lint/${code}`,
    source: 'pss-lint',
    message,
  });
}
