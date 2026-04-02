// Auto-generated - DO NOT EDIT

import type { ASTVisitor } from './visitor';
import { type Location } from './structs';
import * as enums from './enums';
import * as flags from './flags';
export { enums, flags };

export class ScopeChild {
  docstring: string = '';
  location: Location = { fileid: -1, lineno: -1, linepos: -1, extent: -1 };
  parent: Scope | null = null;
  index: number = -1;
  assocData: AssocData | null = null;
  annotations: Annotation[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitScopeChild?.(this) ?? null;
  }
}

export class SymbolChild extends ScopeChild {
  id: number = -1;
  upper: SymbolScope | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolChild?.(this) ?? null;
  }
}

export class SymbolChildrenScope extends SymbolChild {
  name: string = '';
  children: ScopeChild[] = [];
  target: ScopeChild | null = null;

  constructor(name: string = '') {
    super();
    this.name = name;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolChildrenScope?.(this) ?? null;
  }
}

export class SymbolScope extends SymbolChildrenScope {
  symtab: Map<string, number> = new Map();
  imports: SymbolImportSpec | null = null;
  synthetic: boolean = false;
  opaque: boolean = false;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolScope?.(this) ?? null;
  }
}

export class ActivityDecl extends SymbolScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityDecl?.(this) ?? null;
  }
}

export class ActivityStmt extends ScopeChild {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityStmt?.(this) ?? null;
  }
}

export class ActivitySchedulingConstraint extends ScopeChild {
  is_parallel: boolean = false;
  targets: ExprHierarchicalId[] = [];

  constructor(is_parallel: boolean = false) {
    super();
    this.is_parallel = is_parallel;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivitySchedulingConstraint?.(this) ?? null;
  }
}

export class ActivityBindStmt extends ActivityStmt {
  lhs: ExprHierarchicalId | null = null;
  rhs: ExprHierarchicalId[] = [];

  constructor(lhs: ExprHierarchicalId | null = null) {
    super();
    this.lhs = lhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityBindStmt?.(this) ?? null;
  }
}

export class ActivityConstraint extends ActivityStmt {
  constraint: ConstraintStmt | null = null;

  constructor(constraint: ConstraintStmt | null = null) {
    super();
    this.constraint = constraint;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityConstraint?.(this) ?? null;
  }
}

export class ActivityLabeledStmt extends ActivityStmt {
  label: ExprId | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityLabeledStmt?.(this) ?? null;
  }
}

export class ActivityActionHandleTraversal extends ActivityLabeledStmt {
  target: ExprRefPathContext | null = null;
  with_c: ConstraintStmt | null = null;
  initializers: ActionFieldInitializer[] = [];

  constructor(target: ExprRefPathContext | null = null, with_c: ConstraintStmt | null = null) {
    super();
    this.target = target;
    this.with_c = with_c;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityActionHandleTraversal?.(this) ?? null;
  }
}

export class ActivityActionTypeTraversal extends ActivityLabeledStmt {
  target: DataTypeUserDefined | null = null;
  with_c: ConstraintStmt | null = null;
  initializers: ActionFieldInitializer[] = [];

  constructor(target: DataTypeUserDefined | null = null, with_c: ConstraintStmt | null = null) {
    super();
    this.target = target;
    this.with_c = with_c;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityActionTypeTraversal?.(this) ?? null;
  }
}

export class ActionFieldInitializer extends ScopeChild {
  path: ExprHierarchicalId | null = null;
  value: Expr | null = null;

  constructor(path: ExprHierarchicalId | null = null, value: Expr | null = null) {
    super();
    this.path = path;
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActionFieldInitializer?.(this) ?? null;
  }
}

export class ActivityLabeledScope extends SymbolScope {
  label: ExprId | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityLabeledScope?.(this) ?? null;
  }
}

export class ActivitySequence extends ActivityLabeledScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivitySequence?.(this) ?? null;
  }
}

export class ActivityJoinSpec extends ScopeChild {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityJoinSpec?.(this) ?? null;
  }
}

export class ActivityJoinSpecBranch extends ActivityJoinSpec {
  branches: ExprRefPathContext[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityJoinSpecBranch?.(this) ?? null;
  }
}

export class ActivityJoinSpecSelect extends ActivityJoinSpec {
  count: Expr | null = null;

  constructor(count: Expr | null = null) {
    super();
    this.count = count;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityJoinSpecSelect?.(this) ?? null;
  }
}

export class ActivityJoinSpecNone extends ActivityJoinSpec {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityJoinSpecNone?.(this) ?? null;
  }
}

export class ActivityJoinSpecFirst extends ActivityJoinSpec {
  count: Expr | null = null;

  constructor(count: Expr | null = null) {
    super();
    this.count = count;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityJoinSpecFirst?.(this) ?? null;
  }
}

export class ActivityParallel extends ActivityLabeledScope {
  join_spec: ActivityJoinSpec | null = null;

  constructor(join_spec: ActivityJoinSpec | null = null) {
    super();
    this.join_spec = join_spec;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityParallel?.(this) ?? null;
  }
}

export class ActivitySchedule extends ActivityLabeledScope {
  join_spec: ActivityJoinSpec | null = null;

  constructor(join_spec: ActivityJoinSpec | null = null) {
    super();
    this.join_spec = join_spec;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivitySchedule?.(this) ?? null;
  }
}

export class ActivityRepeatCount extends ActivityLabeledStmt {
  loop_var: ExprId | null = null;
  count: Expr | null = null;
  body: ScopeChild | null = null;

  constructor(loop_var: ExprId | null = null, count: Expr | null = null, body: ScopeChild | null = null) {
    super();
    this.loop_var = loop_var;
    this.count = count;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityRepeatCount?.(this) ?? null;
  }
}

export class ActivityRepeatWhile extends ActivityLabeledStmt {
  cond: Expr | null = null;
  body: ScopeChild | null = null;

  constructor(cond: Expr | null = null, body: ScopeChild | null = null) {
    super();
    this.cond = cond;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityRepeatWhile?.(this) ?? null;
  }
}

export class ActivityForeach extends ActivityLabeledStmt {
  it_id: ExprId | null = null;
  idx_id: ExprId | null = null;
  target: ExprRefPathContext | null = null;
  body: ScopeChild | null = null;

  constructor(it_id: ExprId | null = null, idx_id: ExprId | null = null, target: ExprRefPathContext | null = null, body: ScopeChild | null = null) {
    super();
    this.it_id = it_id;
    this.idx_id = idx_id;
    this.target = target;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityForeach?.(this) ?? null;
  }
}

export class ActivitySelect extends ActivityLabeledStmt {
  branches: ActivitySelectBranch[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivitySelect?.(this) ?? null;
  }
}

export class ActivitySelectBranch {
  guard: Expr | null = null;
  weight: Expr | null = null;
  body: ScopeChild | null = null;

  constructor(guard: Expr | null = null, weight: Expr | null = null, body: ScopeChild | null = null) {
    this.guard = guard;
    this.weight = weight;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivitySelectBranch?.(this) ?? null;
  }
}

export class ActivityIfElse extends ActivityLabeledStmt {
  cond: Expr | null = null;
  true_s: ActivityStmt | null = null;
  false_s: ActivityStmt | null = null;

  constructor(cond: Expr | null = null, true_s: ActivityStmt | null = null, false_s: ActivityStmt | null = null) {
    super();
    this.cond = cond;
    this.true_s = true_s;
    this.false_s = false_s;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityIfElse?.(this) ?? null;
  }
}

export class ActivityMatch extends ActivityLabeledStmt {
  cond: Expr | null = null;
  choices: ActivityMatchChoice[] = [];

  constructor(cond: Expr | null = null) {
    super();
    this.cond = cond;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityMatch?.(this) ?? null;
  }
}

export class ActivityMatchChoice {
  is_default: boolean = false;
  cond: ExprOpenRangeList | null = null;
  body: ScopeChild | null = null;

  constructor(is_default: boolean = false, cond: ExprOpenRangeList | null = null, body: ScopeChild | null = null) {
    this.is_default = is_default;
    this.cond = cond;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityMatchChoice?.(this) ?? null;
  }
}

export class ActivityReplicate extends ActivityLabeledStmt {
  idx_id: ExprId | null = null;
  it_label: ExprId | null = null;
  body: ScopeChild | null = null;

  constructor(idx_id: ExprId | null = null, it_label: ExprId | null = null, body: ScopeChild | null = null) {
    super();
    this.idx_id = idx_id;
    this.it_label = it_label;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityReplicate?.(this) ?? null;
  }
}

export class ActivitySuper extends ActivityLabeledStmt {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivitySuper?.(this) ?? null;
  }
}

export class ActivityAtomicBlock extends ActivityLabeledStmt {
  body: ScopeChild | null = null;

  constructor(body: ScopeChild | null = null) {
    super();
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActivityAtomicBlock?.(this) ?? null;
  }
}

export class Annotation extends ScopeChild {
  type: TypeIdentifier | null = null;
  parameters: AnnotationParam[] = [];

  constructor(type: TypeIdentifier | null = null) {
    super();
    this.type = type;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitAnnotation?.(this) ?? null;
  }
}

export class AnnotationParam extends ScopeChild {
  name: ExprId | null = null;
  value: Expr | null = null;

  constructor(value: Expr | null = null) {
    super();
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitAnnotationParam?.(this) ?? null;
  }
}

export class Scope extends ScopeChild {
  endLocation: Location = { fileid: -1, lineno: -1, linepos: -1, extent: -1 };
  children: ScopeChild[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitScope?.(this) ?? null;
  }
}

export class NamedScope extends Scope {
  name: ExprId | null = null;

  constructor(name: ExprId | null = null) {
    super();
    this.name = name;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitNamedScope?.(this) ?? null;
  }
}

export class TypeScope extends NamedScope {
  super_t: TypeIdentifier | null = null;
  params: TemplateParamDeclList | null = null;
  opaque: boolean = false;

  constructor(super_t: TypeIdentifier | null = null) {
    super();
    this.super_t = super_t;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTypeScope?.(this) ?? null;
  }
}

export class AnnotationDecl extends TypeScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitAnnotationDecl?.(this) ?? null;
  }
}

export class GenericConstraintParam {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitGenericConstraintParam?.(this) ?? null;
  }
}

export class GenericConstraintDeclBool {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitGenericConstraintDeclBool?.(this) ?? null;
  }
}

export class GenericConstraintDeclValue {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitGenericConstraintDeclValue?.(this) ?? null;
  }
}

export class ConstraintBlock {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintBlock?.(this) ?? null;
  }
}

export class ConstraintScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintScope?.(this) ?? null;
  }
}

export class ConstraintSymbolScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintSymbolScope?.(this) ?? null;
  }
}

export class ConstraintStmt {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmt?.(this) ?? null;
  }
}

export class ConstraintStmtExpr {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtExpr?.(this) ?? null;
  }
}

export class ConstraintStmtForeach {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtForeach?.(this) ?? null;
  }
}

export class ConstraintStmtField {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtField?.(this) ?? null;
  }
}

export class ConstraintStmtForall {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtForall?.(this) ?? null;
  }
}

export class ConstraintStmtIf {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtIf?.(this) ?? null;
  }
}

export class ConstraintStmtImplication {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtImplication?.(this) ?? null;
  }
}

export class ConstraintStmtUnique {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtUnique?.(this) ?? null;
  }
}

export class ConstraintStmtDefault {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtDefault?.(this) ?? null;
  }
}

export class ConstraintStmtDefaultDisable {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitConstraintStmtDefaultDisable?.(this) ?? null;
  }
}

export class AssocData {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitAssocData?.(this) ?? null;
  }
}

export class ScopeChildRef extends ScopeChild {
  target: ScopeChild | null = null;

  constructor(target: ScopeChild | null = null) {
    super();
    this.target = target;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitScopeChildRef?.(this) ?? null;
  }
}

export class GlobalScope extends Scope {
  fileid: number = 0;
  filename: string = '';

  constructor(fileid: number = 0) {
    super();
    this.fileid = fileid;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitGlobalScope?.(this) ?? null;
  }
}

export class NamedScopeChild extends ScopeChild {
  name: ExprId | null = null;

  constructor(name: ExprId | null = null) {
    super();
    this.name = name;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitNamedScopeChild?.(this) ?? null;
  }
}

export class PackageScope extends Scope {
  id: ExprId[] = [];
  sibling: PackageScope | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitPackageScope?.(this) ?? null;
  }
}

export class PackageImportStmt extends ScopeChild {
  wildcard: boolean = false;
  alias: ExprId | null = null;
  path: TypeIdentifier | null = null;

  constructor(wildcard: boolean = false, alias: ExprId | null = null) {
    super();
    this.wildcard = wildcard;
    this.alias = alias;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitPackageImportStmt?.(this) ?? null;
  }
}

export class PyImportStmt extends ScopeChild {
  path: ExprId[] = [];
  alias: ExprId | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitPyImportStmt?.(this) ?? null;
  }
}

export class PyImportFromStmt extends ScopeChild {
  path: ExprId[] = [];
  targets: ExprId[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitPyImportFromStmt?.(this) ?? null;
  }
}

export class Action extends TypeScope {
  is_abstract: boolean = false;
  is_override: boolean = false;

  constructor(is_abstract: boolean = false) {
    super();
    this.is_abstract = is_abstract;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitAction?.(this) ?? null;
  }
}

export class Component extends TypeScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitComponent?.(this) ?? null;
  }
}

export class DataType extends ScopeChild {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataType?.(this) ?? null;
  }
}

export class DataTypeBool extends DataType {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataTypeBool?.(this) ?? null;
  }
}

export class DataTypeChandle extends DataType {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataTypeChandle?.(this) ?? null;
  }
}

export class DataTypeEnum extends DataType {
  tid: DataTypeUserDefined | null = null;
  in_rangelist: ExprOpenRangeList | null = null;

  constructor(tid: DataTypeUserDefined | null = null, in_rangelist: ExprOpenRangeList | null = null) {
    super();
    this.tid = tid;
    this.in_rangelist = in_rangelist;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataTypeEnum?.(this) ?? null;
  }
}

export class EnumItem extends NamedScopeChild {
  value: Expr | null = null;
  upper: SymbolEnumScope | null = null;

  constructor(value: Expr | null = null) {
    super();
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitEnumItem?.(this) ?? null;
  }
}

export class EnumDecl extends NamedScopeChild {
  items: EnumItem[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitEnumDecl?.(this) ?? null;
  }
}

export class DataTypeInt extends DataType {
  is_signed: boolean = false;
  width: Expr | null = null;
  in_range: ExprDomainOpenRangeList | null = null;

  constructor(is_signed: boolean = false, width: Expr | null = null, in_range: ExprDomainOpenRangeList | null = null) {
    super();
    this.is_signed = is_signed;
    this.width = width;
    this.in_range = in_range;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataTypeInt?.(this) ?? null;
  }
}

export class DataTypePyObj extends DataType {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataTypePyObj?.(this) ?? null;
  }
}

export class DataTypeRef extends DataType {
  type: DataTypeUserDefined | null = null;

  constructor(type: DataTypeUserDefined | null = null) {
    super();
    this.type = type;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataTypeRef?.(this) ?? null;
  }
}

export class DataTypeString extends DataType {
  has_range: boolean = false;
  in_range: string[] = [];

  constructor(has_range: boolean = false) {
    super();
    this.has_range = has_range;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataTypeString?.(this) ?? null;
  }
}

export class DataTypeUserDefined extends DataType {
  is_global: boolean = false;
  type_id: TypeIdentifier | null = null;

  constructor(is_global: boolean = false, type_id: TypeIdentifier | null = null) {
    super();
    this.is_global = is_global;
    this.type_id = type_id;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitDataTypeUserDefined?.(this) ?? null;
  }
}

export class TypedefDeclaration extends ScopeChild {
  name: ExprId | null = null;
  type: DataType | null = null;

  constructor(name: ExprId | null = null, type: DataType | null = null) {
    super();
    this.name = name;
    this.type = type;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTypedefDeclaration?.(this) ?? null;
  }
}

export class ExecStmt extends ScopeChild {
  upper: SymbolScope | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExecStmt?.(this) ?? null;
  }
}

export class ExecScope extends SymbolScope {
  endLocation: Location = { fileid: -1, lineno: -1, linepos: -1, extent: -1 };

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExecScope?.(this) ?? null;
  }
}

export class ExecBlock extends ExecScope {
  kind: enums.ExecKind = enums.ExecKind.ExecKind_Body;

  constructor(kind: enums.ExecKind = 0 as any) {
    super();
    this.kind = kind;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExecBlock?.(this) ?? null;
  }
}

export class ExecTargetTemplateBlock extends ScopeChild {
  kind: enums.ExecKind = enums.ExecKind.ExecKind_Body;
  data: string = '';
  parameters: ExecTargetTemplateParam[] = [];

  constructor(kind: enums.ExecKind = 0 as any, data: string = '') {
    super();
    this.kind = kind;
    this.data = data;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExecTargetTemplateBlock?.(this) ?? null;
  }
}

export class ExecTargetTemplateParam {
  expr: Expr | null = null;
  start: number = 0;
  end: number = 0;

  constructor(expr: Expr | null = null, start: number = 0, end: number = 0) {
    this.expr = expr;
    this.start = start;
    this.end = end;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExecTargetTemplateParam?.(this) ?? null;
  }
}

export class ProceduralStmtAssignment extends ExecStmt {
  lhs: Expr | null = null;
  op: enums.AssignOp = enums.AssignOp.AssignOp_Eq;
  rhs: Expr | null = null;

  constructor(lhs: Expr | null = null, op: enums.AssignOp = 0 as any, rhs: Expr | null = null) {
    super();
    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtAssignment?.(this) ?? null;
  }
}

export class ProceduralStmtExpr extends ExecStmt {
  expr: Expr | null = null;

  constructor(expr: Expr | null = null) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtExpr?.(this) ?? null;
  }
}

export class ProceduralStmtFunctionCall extends ExecStmt {
  prefix: ExprRefPathStaticRooted | null = null;
  params: Expr[] = [];

  constructor(prefix: ExprRefPathStaticRooted | null = null) {
    super();
    this.prefix = prefix;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtFunctionCall?.(this) ?? null;
  }
}

export class ProceduralStmtReturn extends ExecStmt {
  expr: Expr | null = null;

  constructor(expr: Expr | null = null) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtReturn?.(this) ?? null;
  }
}

export class ProceduralStmtSymbolBodyScope extends SymbolScope {
  body: ScopeChild | null = null;

  constructor(body: ScopeChild | null = null) {
    super();
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtSymbolBodyScope?.(this) ?? null;
  }
}

export class ProceduralStmtRepeat extends ProceduralStmtSymbolBodyScope {
  it_id: ExprId | null = null;
  count: Expr | null = null;

  constructor(it_id: ExprId | null = null, count: Expr | null = null) {
    super();
    this.it_id = it_id;
    this.count = count;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtRepeat?.(this) ?? null;
  }
}

export class ProceduralStmtBody extends ExecStmt {
  body: ScopeChild | null = null;

  constructor(body: ScopeChild | null = null) {
    super();
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtBody?.(this) ?? null;
  }
}

export class ProceduralStmtRepeatWhile extends ProceduralStmtBody {
  expr: Expr | null = null;

  constructor(expr: Expr | null = null) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtRepeatWhile?.(this) ?? null;
  }
}

export class ProceduralStmtWhile extends ProceduralStmtBody {
  expr: Expr | null = null;

  constructor(expr: Expr | null = null) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtWhile?.(this) ?? null;
  }
}

export class ProceduralStmtForeach extends ProceduralStmtSymbolBodyScope {
  path: ExprRefPath | null = null;
  it_id: ExprId | null = null;
  idx_id: ExprId | null = null;

  constructor(path: ExprRefPath | null = null, it_id: ExprId | null = null, idx_id: ExprId | null = null) {
    super();
    this.path = path;
    this.it_id = it_id;
    this.idx_id = idx_id;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtForeach?.(this) ?? null;
  }
}

export class ProceduralStmtIfClause extends ScopeChild {
  cond: Expr | null = null;
  body: ScopeChild | null = null;

  constructor(cond: Expr | null = null, body: ScopeChild | null = null) {
    super();
    this.cond = cond;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtIfClause?.(this) ?? null;
  }
}

export class ProceduralStmtIfElse extends ExecStmt {
  if_then: ProceduralStmtIfClause[] = [];
  else_then: ScopeChild | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtIfElse?.(this) ?? null;
  }
}

export class ProceduralStmtMatch extends ExecStmt {
  expr: Expr | null = null;
  choices: ProceduralStmtMatchChoice[] = [];

  constructor(expr: Expr | null = null) {
    super();
    this.expr = expr;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtMatch?.(this) ?? null;
  }
}

export class ProceduralStmtMatchChoice extends ExecStmt {
  is_default: boolean = false;
  cond: ExprOpenRangeList | null = null;
  body: ScopeChild | null = null;

  constructor(is_default: boolean = false, cond: ExprOpenRangeList | null = null, body: ScopeChild | null = null) {
    super();
    this.is_default = is_default;
    this.cond = cond;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtMatchChoice?.(this) ?? null;
  }
}

export class ProceduralStmtBreak extends ExecStmt {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtBreak?.(this) ?? null;
  }
}

export class ProceduralStmtContinue extends ExecStmt {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtContinue?.(this) ?? null;
  }
}

export class ProceduralStmtDataDeclaration extends ExecStmt {
  name: ExprId | null = null;
  datatype: DataType | null = null;
  init: Expr | null = null;

  constructor(name: ExprId | null = null, datatype: DataType | null = null, init: Expr | null = null) {
    super();
    this.name = name;
    this.datatype = datatype;
    this.init = init;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtDataDeclaration?.(this) ?? null;
  }
}

export class ProceduralStmtYield extends ExecStmt {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtYield?.(this) ?? null;
  }
}

export class ProceduralStmtRandomize extends ExecStmt {
  target: Expr | null = null;
  constraints: ConstraintStmt[] = [];

  constructor(target: Expr | null = null) {
    super();
    this.target = target;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitProceduralStmtRandomize?.(this) ?? null;
  }
}

export class Expr {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExpr?.(this) ?? null;
  }
}

export class ExprAggrLiteral extends Expr {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprAggrLiteral?.(this) ?? null;
  }
}

export class ExprAggrEmpty extends ExprAggrLiteral {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprAggrEmpty?.(this) ?? null;
  }
}

export class ExprAggrList extends ExprAggrLiteral {
  elems: Expr[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprAggrList?.(this) ?? null;
  }
}

export class ExprAggrMapElem {
  lhs: Expr | null = null;
  rhs: Expr | null = null;

  constructor(lhs: Expr | null = null, rhs: Expr | null = null) {
    this.lhs = lhs;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprAggrMapElem?.(this) ?? null;
  }
}

export class ExprAggrMap extends ExprAggrLiteral {
  elems: ExprAggrMapElem[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprAggrMap?.(this) ?? null;
  }
}

export class ExprAggrStructElem {
  name: ExprId | null = null;
  target: number = -1;
  value: Expr | null = null;

  constructor(name: ExprId | null = null, value: Expr | null = null) {
    this.name = name;
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprAggrStructElem?.(this) ?? null;
  }
}

export class ExprAggrStruct extends ExprAggrLiteral {
  elems: ExprAggrStructElem[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprAggrStruct?.(this) ?? null;
  }
}

export class ExprBin extends Expr {
  lhs: Expr | null = null;
  op: enums.ExprBinOp = enums.ExprBinOp.BinOp_LogOr;
  rhs: Expr | null = null;

  constructor(lhs: Expr | null = null, op: enums.ExprBinOp = 0 as any, rhs: Expr | null = null) {
    super();
    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprBin?.(this) ?? null;
  }
}

export class ExprBitSlice extends Expr {
  lhs: Expr | null = null;
  rhs: Expr | null = null;

  constructor(lhs: Expr | null = null, rhs: Expr | null = null) {
    super();
    this.lhs = lhs;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprBitSlice?.(this) ?? null;
  }
}

export class ExprBool extends Expr {
  value: boolean = false;

  constructor(value: boolean = false) {
    super();
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprBool?.(this) ?? null;
  }
}

export class ExprCast extends Expr {
  casting_type: DataType | null = null;
  expr: Expr | null = null;

  constructor(casting_type: DataType | null = null, expr: Expr | null = null) {
    super();
    this.casting_type = casting_type;
    this.expr = expr;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprCast?.(this) ?? null;
  }
}

export class ExprCompileHas extends Expr {
  ref: ExprRefPathStatic | null = null;

  constructor(ref: ExprRefPathStatic | null = null) {
    super();
    this.ref = ref;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprCompileHas?.(this) ?? null;
  }
}

export class ExprCond extends Expr {
  cond_e: Expr | null = null;
  true_e: Expr | null = null;
  false_e: Expr | null = null;

  constructor(cond_e: Expr | null = null, true_e: Expr | null = null, false_e: Expr | null = null) {
    super();
    this.cond_e = cond_e;
    this.true_e = true_e;
    this.false_e = false_e;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprCond?.(this) ?? null;
  }
}

export class ExprDomainOpenRangeList extends Expr {
  values: ExprDomainOpenRangeValue[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprDomainOpenRangeList?.(this) ?? null;
  }
}

export class ExprDomainOpenRangeValue extends Expr {
  single: boolean = false;
  lhs: Expr | null = null;
  rhs: Expr | null = null;

  constructor(single: boolean = false, lhs: Expr | null = null, rhs: Expr | null = null) {
    super();
    this.single = single;
    this.lhs = lhs;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprDomainOpenRangeValue?.(this) ?? null;
  }
}

export class ExprHierarchicalId extends Expr {
  elems: ExprMemberPathElem[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprHierarchicalId?.(this) ?? null;
  }
}

export class ExprId extends Expr {
  id: string = '';
  is_escaped: boolean = false;
  location: Location = { fileid: -1, lineno: -1, linepos: -1, extent: -1 };

  constructor(id: string = '', is_escaped: boolean = false) {
    super();
    this.id = id;
    this.is_escaped = is_escaped;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprId?.(this) ?? null;
  }
}

export class ExprIn extends Expr {
  lhs: Expr | null = null;
  rhs: ExprOpenRangeList | null = null;

  constructor(lhs: Expr | null = null, rhs: ExprOpenRangeList | null = null) {
    super();
    this.lhs = lhs;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprIn?.(this) ?? null;
  }
}

export class ExprListLiteral extends Expr {
  value: Expr[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprListLiteral?.(this) ?? null;
  }
}

export class ExprStructLiteral extends Expr {
  values: ExprStructLiteralItem[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprStructLiteral?.(this) ?? null;
  }
}

export class ExprStructLiteralItem extends Expr {
  id: ExprId | null = null;
  value: Expr | null = null;

  constructor(id: ExprId | null = null, value: Expr | null = null) {
    super();
    this.id = id;
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprStructLiteralItem?.(this) ?? null;
  }
}

export class ExprMemberPathElem extends Expr {
  id: ExprId | null = null;
  params: MethodParameterList | null = null;
  subscript: Expr[] = [];
  target: number = -1;
  super: number = -1;
  string_method_id: enums.StringMethodId = enums.StringMethodId.StringMethod_None;

  constructor(id: ExprId | null = null, params: MethodParameterList | null = null) {
    super();
    this.id = id;
    this.params = params;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprMemberPathElem?.(this) ?? null;
  }
}

export class ExprNull extends Expr {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprNull?.(this) ?? null;
  }
}

export class ExprNumber extends Expr {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprNumber?.(this) ?? null;
  }
}

export class ExprOpenRangeList extends Expr {
  values: ExprOpenRangeValue[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprOpenRangeList?.(this) ?? null;
  }
}

export class ExprOpenRangeValue extends Expr {
  lhs: Expr | null = null;
  rhs: Expr | null = null;

  constructor(lhs: Expr | null = null, rhs: Expr | null = null) {
    super();
    this.lhs = lhs;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprOpenRangeValue?.(this) ?? null;
  }
}

export class ExprRefPath extends Expr {
  target: SymbolRefPath | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprRefPath?.(this) ?? null;
  }
}

export class ExprRefPathId extends ExprRefPath {
  id: ExprId | null = null;
  slice: ExprBitSlice | null = null;

  constructor(id: ExprId | null = null) {
    super();
    this.id = id;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprRefPathId?.(this) ?? null;
  }
}

export class ExprRefPathContext extends ExprRefPath {
  is_super: boolean = false;
  hier_id: ExprHierarchicalId | null = null;
  slice: ExprBitSlice | null = null;

  constructor(hier_id: ExprHierarchicalId | null = null) {
    super();
    this.hier_id = hier_id;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprRefPathContext?.(this) ?? null;
  }
}

export class ExprRefPathElem extends Expr {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprRefPathElem?.(this) ?? null;
  }
}

export class ExprRefPathStatic extends ExprRefPath {
  is_global: boolean = false;
  base: TypeIdentifierElem[] = [];
  slice: ExprBitSlice | null = null;

  constructor(is_global: boolean = false) {
    super();
    this.is_global = is_global;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprRefPathStatic?.(this) ?? null;
  }
}

export class ExprRefPathStaticFunc extends ExprRefPathStatic {
  params: MethodParameterList | null = null;

  constructor(params: MethodParameterList | null = null) {
    super();
    this.params = params;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprRefPathStaticFunc?.(this) ?? null;
  }
}

export class ExprRefPathStaticRooted extends ExprRefPath {
  root: ExprRefPathStatic | null = null;
  leaf: ExprHierarchicalId | null = null;
  slice: ExprBitSlice | null = null;

  constructor(root: ExprRefPathStatic | null = null, leaf: ExprHierarchicalId | null = null) {
    super();
    this.root = root;
    this.leaf = leaf;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprRefPathStaticRooted?.(this) ?? null;
  }
}

export class ExprRefPathSuper extends ExprRefPathContext {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprRefPathSuper?.(this) ?? null;
  }
}

export class ExprSignedNumber extends ExprNumber {
  image: string = '';
  width: number = 0;
  value: number = 0;

  constructor(image: string = '', width: number = 0, value: number = 0) {
    super();
    this.image = image;
    this.width = width;
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprSignedNumber?.(this) ?? null;
  }
}

export class ExprStaticRefPath extends Expr {
  is_global: boolean = false;
  base: TypeIdentifierElem[] = [];
  leaf: ExprMemberPathElem | null = null;

  constructor(is_global: boolean = false, leaf: ExprMemberPathElem | null = null) {
    super();
    this.is_global = is_global;
    this.leaf = leaf;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprStaticRefPath?.(this) ?? null;
  }
}

export class ExprString extends Expr {
  value: string = '';
  is_raw: boolean = false;

  constructor(value: string = '', is_raw: boolean = false) {
    super();
    this.value = value;
    this.is_raw = is_raw;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprString?.(this) ?? null;
  }
}

export class ExprSubstring extends Expr {
  expr: Expr | null = null;
  start: Expr | null = null;
  end: Expr | null = null;

  constructor(expr: Expr | null = null, start: Expr | null = null, end: Expr | null = null) {
    super();
    this.expr = expr;
    this.start = start;
    this.end = end;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprSubstring?.(this) ?? null;
  }
}

export class ExprSubscript extends Expr {
  expr: Expr | null = null;
  subscript: Expr | null = null;

  constructor(expr: Expr | null = null, subscript: Expr | null = null) {
    super();
    this.expr = expr;
    this.subscript = subscript;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprSubscript?.(this) ?? null;
  }
}

export class ExprUnary extends Expr {
  op: enums.ExprUnaryOp = enums.ExprUnaryOp.UnaryOp_Plus;
  rhs: Expr | null = null;

  constructor(op: enums.ExprUnaryOp = 0 as any, rhs: Expr | null = null) {
    super();
    this.op = op;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprUnary?.(this) ?? null;
  }
}

export class ExprUnsignedNumber extends ExprNumber {
  image: string = '';
  width: number = 0;
  value: number = 0;

  constructor(image: string = '', width: number = 0, value: number = 0) {
    super();
    this.image = image;
    this.width = width;
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExprUnsignedNumber?.(this) ?? null;
  }
}

export class MethodParameterList extends Expr {
  parameters: Expr[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMethodParameterList?.(this) ?? null;
  }
}

export class TypeIdentifier extends Expr {
  elems: TypeIdentifierElem[] = [];
  target: SymbolRefPath | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTypeIdentifier?.(this) ?? null;
  }
}

export class TypeIdentifierElem extends Expr {
  id: ExprId | null = null;
  params: TemplateParamValueList | null = null;

  constructor(id: ExprId | null = null, params: TemplateParamValueList | null = null) {
    super();
    this.id = id;
    this.params = params;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTypeIdentifierElem?.(this) ?? null;
  }
}

export class ExtendType extends Scope {
  kind: enums.ExtendTargetE = enums.ExtendTargetE.Action;
  target: TypeIdentifier | null = null;
  symtab: Map<string, number> = new Map();
  imports: SymbolImportSpec | null = null;

  constructor(kind: enums.ExtendTargetE = 0 as any, target: TypeIdentifier | null = null) {
    super();
    this.kind = kind;
    this.target = target;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExtendType?.(this) ?? null;
  }
}

export class ExtendEnum extends ScopeChild {
  target: TypeIdentifier | null = null;
  items: EnumItem[] = [];

  constructor(target: TypeIdentifier | null = null) {
    super();
    this.target = target;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExtendEnum?.(this) ?? null;
  }
}

export class Field extends NamedScopeChild {
  type: DataType | null = null;
  attr: flags.FieldAttr = flags.FieldAttr.None;
  init: Expr | null = null;

  constructor(type: DataType | null = null, attr: flags.FieldAttr = 0 as any, init: Expr | null = null) {
    super();
    this.type = type;
    this.attr = attr;
    this.init = init;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitField?.(this) ?? null;
  }
}

export class FieldCompRef extends NamedScopeChild {
  type: DataTypeUserDefined | null = null;

  constructor(type: DataTypeUserDefined | null = null) {
    super();
    this.type = type;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFieldCompRef?.(this) ?? null;
  }
}

export class FieldRef extends NamedScopeChild {
  type: DataTypeUserDefined | null = null;
  is_input: boolean = false;

  constructor(type: DataTypeUserDefined | null = null, is_input: boolean = false) {
    super();
    this.type = type;
    this.is_input = is_input;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFieldRef?.(this) ?? null;
  }
}

export class FieldClaim extends NamedScopeChild {
  type: DataTypeUserDefined | null = null;
  is_lock: boolean = false;

  constructor(type: DataTypeUserDefined | null = null, is_lock: boolean = false) {
    super();
    this.type = type;
    this.is_lock = is_lock;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFieldClaim?.(this) ?? null;
  }
}

export class ActionHandleField extends NamedScopeChild {
  type: DataType | null = null;
  initializers: ActionFieldInitializer[] = [];

  constructor(type: DataType | null = null) {
    super();
    this.type = type;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitActionHandleField?.(this) ?? null;
  }
}

export class FunctionDefinition extends ScopeChild {
  endLocation: Location = { fileid: -1, lineno: -1, linepos: -1, extent: -1 };
  proto: FunctionPrototype | null = null;
  body: ExecScope | null = null;
  plat: enums.PlatQual = enums.PlatQual.PlatQual_None;

  constructor(proto: FunctionPrototype | null = null, body: ExecScope | null = null, plat: enums.PlatQual = 0 as any) {
    super();
    this.proto = proto;
    this.body = body;
    this.plat = plat;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFunctionDefinition?.(this) ?? null;
  }
}

export class FunctionParamDecl extends ScopeChild {
  kind: enums.FunctionParamDeclKind = enums.FunctionParamDeclKind.ParamKind_DataType;
  name: ExprId | null = null;
  type: DataType | null = null;
  dir: enums.ParamDir = enums.ParamDir.ParamDir_Default;
  dflt: Expr | null = null;
  is_varargs: boolean = false;

  constructor(kind: enums.FunctionParamDeclKind = 0 as any, name: ExprId | null = null, type: DataType | null = null, dir: enums.ParamDir = 0 as any, dflt: Expr | null = null) {
    super();
    this.kind = kind;
    this.name = name;
    this.type = type;
    this.dir = dir;
    this.dflt = dflt;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFunctionParamDecl?.(this) ?? null;
  }
}

export class FunctionPrototype extends NamedScopeChild {
  rtype: DataType | null = null;
  parameters: FunctionParamDecl[] = [];
  is_pure: boolean = false;
  is_target: boolean = false;
  is_solve: boolean = false;
  is_core: boolean = false;

  constructor(rtype: DataType | null = null, is_target: boolean = false, is_solve: boolean = false) {
    super();
    this.rtype = rtype;
    this.is_target = is_target;
    this.is_solve = is_solve;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFunctionPrototype?.(this) ?? null;
  }
}

export class FunctionImport extends ScopeChild {
  plat: enums.PlatQual = enums.PlatQual.PlatQual_None;
  lang: string = '';

  constructor(plat: enums.PlatQual = 0 as any, lang: string = '') {
    super();
    this.plat = plat;
    this.lang = lang;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFunctionImport?.(this) ?? null;
  }
}

export class FunctionImportType extends FunctionImport {
  type: TypeIdentifier | null = null;

  constructor(type: TypeIdentifier | null = null) {
    super();
    this.type = type;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFunctionImportType?.(this) ?? null;
  }
}

export class FunctionImportProto extends FunctionImport {
  proto: FunctionPrototype | null = null;

  constructor(proto: FunctionPrototype | null = null) {
    super();
    this.proto = proto;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitFunctionImportProto?.(this) ?? null;
  }
}

export class ExportFunction extends ScopeChild {
  plat: enums.PlatQual = enums.PlatQual.PlatQual_None;
  name: ExprId | null = null;

  constructor(plat: enums.PlatQual = 0 as any, name: ExprId | null = null) {
    super();
    this.plat = plat;
    this.name = name;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitExportFunction?.(this) ?? null;
  }
}

export class SymbolScopeRef extends ScopeChild {
  name: string = '';

  constructor(name: string = '') {
    super();
    this.name = name;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolScopeRef?.(this) ?? null;
  }
}

export class RootSymbolScope extends SymbolScope {
  units: GlobalScope[] = [];
  filenames: Map<number, string> = new Map();
  id2idx: Map<number, number> = new Map();
  fileOutRef: number[][] = [];
  fileInRef: number[][] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitRootSymbolScope?.(this) ?? null;
  }
}

export class SymbolEnumScope extends SymbolScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolEnumScope?.(this) ?? null;
  }
}

export class SymbolExtendScope extends SymbolScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolExtendScope?.(this) ?? null;
  }
}

export class SymbolImportSpec {
  imports: PackageImportStmt[] = [];
  symtab: Map<string, SymbolRefPath | null> = new Map();

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolImportSpec?.(this) ?? null;
  }
}

export class SymbolTypeScope extends SymbolScope {
  plist: SymbolScope | null = null;
  spec_types: SymbolTypeScope[] = [];

  constructor(plist: SymbolScope | null = null) {
    super();
    this.plist = plist;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolTypeScope?.(this) ?? null;
  }
}

export class SymbolFunctionScope extends SymbolScope {
  prototypes: FunctionPrototype[] = [];
  import_specs: FunctionImport[] = [];
  definition: FunctionDefinition | null = null;
  plist: SymbolScope | null = null;
  body: ExecScope | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolFunctionScope?.(this) ?? null;
  }
}

export class SymbolRefPath {
  path: SymbolRefPath[] = [];
  pyref_idx: number = -1;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitSymbolRefPath?.(this) ?? null;
  }
}

export class Monitor extends TypeScope {
  is_abstract: boolean = false;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitor?.(this) ?? null;
  }
}

export class MonitorActivityStmt extends ScopeChild {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityStmt?.(this) ?? null;
  }
}

export class MonitorActivityDecl extends SymbolScope {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityDecl?.(this) ?? null;
  }
}

export class MonitorActivitySequence extends SymbolScope {
  label: ExprId | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivitySequence?.(this) ?? null;
  }
}

export class MonitorActivityConcat extends MonitorActivityStmt {
  lhs: MonitorActivityStmt | null = null;
  rhs: MonitorActivityStmt | null = null;

  constructor(lhs: MonitorActivityStmt | null = null, rhs: MonitorActivityStmt | null = null) {
    super();
    this.lhs = lhs;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityConcat?.(this) ?? null;
  }
}

export class MonitorActivityEventually extends MonitorActivityStmt {
  condition: Expr | null = null;
  body: MonitorActivityStmt | null = null;

  constructor(condition: Expr | null = null, body: MonitorActivityStmt | null = null) {
    super();
    this.condition = condition;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityEventually?.(this) ?? null;
  }
}

export class MonitorActivityOverlap extends MonitorActivityStmt {
  lhs: MonitorActivityStmt | null = null;
  rhs: MonitorActivityStmt | null = null;

  constructor(lhs: MonitorActivityStmt | null = null, rhs: MonitorActivityStmt | null = null) {
    super();
    this.lhs = lhs;
    this.rhs = rhs;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityOverlap?.(this) ?? null;
  }
}

export class MonitorActivitySchedule extends SymbolScope {
  label: ExprId | null = null;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivitySchedule?.(this) ?? null;
  }
}

export class MonitorActivitySelect extends MonitorActivityStmt {
  label: ExprId | null = null;
  branches: MonitorActivitySelectBranch[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivitySelect?.(this) ?? null;
  }
}

export class MonitorActivitySelectBranch {
  guard: Expr | null = null;
  body: ScopeChild | null = null;

  constructor(guard: Expr | null = null, body: ScopeChild | null = null) {
    this.guard = guard;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivitySelectBranch?.(this) ?? null;
  }
}

export class MonitorActivityActionTraversal extends MonitorActivityStmt {
  target: ExprRefPath | null = null;
  with_c: ConstraintStmt | null = null;

  constructor(target: ExprRefPath | null = null, with_c: ConstraintStmt | null = null) {
    super();
    this.target = target;
    this.with_c = with_c;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityActionTraversal?.(this) ?? null;
  }
}

export class MonitorActivityMonitorTraversal extends MonitorActivityStmt {
  target: ExprRefPath | null = null;
  with_c: ConstraintStmt | null = null;

  constructor(target: ExprRefPath | null = null, with_c: ConstraintStmt | null = null) {
    super();
    this.target = target;
    this.with_c = with_c;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityMonitorTraversal?.(this) ?? null;
  }
}

export class MonitorConstraint extends MonitorActivityStmt {
  constraint: ConstraintStmt | null = null;

  constructor(constraint: ConstraintStmt | null = null) {
    super();
    this.constraint = constraint;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorConstraint?.(this) ?? null;
  }
}

export class MonitorActivityRepeatCount extends MonitorActivityStmt {
  loop_var: ExprId | null = null;
  count: Expr | null = null;
  body: ScopeChild | null = null;

  constructor(loop_var: ExprId | null = null, count: Expr | null = null, body: ScopeChild | null = null) {
    super();
    this.loop_var = loop_var;
    this.count = count;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityRepeatCount?.(this) ?? null;
  }
}

export class MonitorActivityRepeatWhile extends MonitorActivityStmt {
  cond: Expr | null = null;
  body: ScopeChild | null = null;

  constructor(cond: Expr | null = null, body: ScopeChild | null = null) {
    super();
    this.cond = cond;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityRepeatWhile?.(this) ?? null;
  }
}

export class MonitorActivityIfElse extends MonitorActivityStmt {
  cond: Expr | null = null;
  true_s: MonitorActivityStmt | null = null;
  false_s: MonitorActivityStmt | null = null;

  constructor(cond: Expr | null = null, true_s: MonitorActivityStmt | null = null, false_s: MonitorActivityStmt | null = null) {
    super();
    this.cond = cond;
    this.true_s = true_s;
    this.false_s = false_s;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityIfElse?.(this) ?? null;
  }
}

export class MonitorActivityMatch extends MonitorActivityStmt {
  cond: Expr | null = null;
  choices: MonitorActivityMatchChoice[] = [];

  constructor(cond: Expr | null = null) {
    super();
    this.cond = cond;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityMatch?.(this) ?? null;
  }
}

export class MonitorActivityMatchChoice {
  is_default: boolean = false;
  cond: ExprOpenRangeList | null = null;
  body: ScopeChild | null = null;

  constructor(is_default: boolean = false, cond: ExprOpenRangeList | null = null, body: ScopeChild | null = null) {
    this.is_default = is_default;
    this.cond = cond;
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitMonitorActivityMatchChoice?.(this) ?? null;
  }
}

export class CoverStmtInline extends ScopeChild {
  body: ScopeChild | null = null;

  constructor(body: ScopeChild | null = null) {
    super();
    this.body = body;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitCoverStmtInline?.(this) ?? null;
  }
}

export class CoverStmtReference extends ScopeChild {
  target: ExprRefPath | null = null;

  constructor(target: ExprRefPath | null = null) {
    super();
    this.target = target;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitCoverStmtReference?.(this) ?? null;
  }
}

export class RefExpr {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitRefExpr?.(this) ?? null;
  }
}

export class RefExprTypeScopeGlobal extends RefExpr {
  fileid: number = 0;

  constructor(fileid: number = 0) {
    super();
    this.fileid = fileid;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitRefExprTypeScopeGlobal?.(this) ?? null;
  }
}

export class RefExprTypeScopeContext extends RefExpr {
  base: RefExpr | null = null;
  offset: number = 0;

  constructor(base: RefExpr | null = null, offset: number = 0) {
    super();
    this.base = base;
    this.offset = offset;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitRefExprTypeScopeContext?.(this) ?? null;
  }
}

export class RefExprScopeIndex extends RefExpr {
  base: RefExpr | null = null;
  offset: number = 0;

  constructor(base: RefExpr | null = null, offset: number = 0) {
    super();
    this.base = base;
    this.offset = offset;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitRefExprScopeIndex?.(this) ?? null;
  }
}

export class Struct extends TypeScope {
  kind: enums.StructKind = enums.StructKind.Buffer;

  constructor(kind: enums.StructKind = 0 as any) {
    super();
    this.kind = kind;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitStruct?.(this) ?? null;
  }
}

export class TemplateParamDeclList {
  params: TemplateParamDecl[] = [];
  specialized: boolean = false;

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateParamDeclList?.(this) ?? null;
  }
}

export class TemplateParamDecl extends ScopeChild {
  name: ExprId | null = null;

  constructor(name: ExprId | null = null) {
    super();
    this.name = name;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateParamDecl?.(this) ?? null;
  }
}

export class TemplateGenericTypeParamDecl extends TemplateParamDecl {
  dflt: DataType | null = null;

  constructor(dflt: DataType | null = null) {
    super();
    this.dflt = dflt;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateGenericTypeParamDecl?.(this) ?? null;
  }
}

export class TemplateCategoryTypeParamDecl extends TemplateParamDecl {
  category: enums.TypeCategory = enums.TypeCategory.Action;
  restriction: TypeIdentifier | null = null;
  dflt: DataType | null = null;

  constructor(category: enums.TypeCategory = 0 as any, restriction: TypeIdentifier | null = null, dflt: DataType | null = null) {
    super();
    this.category = category;
    this.restriction = restriction;
    this.dflt = dflt;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateCategoryTypeParamDecl?.(this) ?? null;
  }
}

export class TemplateValueParamDecl extends TemplateParamDecl {
  type: DataType | null = null;
  dflt: Expr | null = null;

  constructor(type: DataType | null = null, dflt: Expr | null = null) {
    super();
    this.type = type;
    this.dflt = dflt;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateValueParamDecl?.(this) ?? null;
  }
}

export class TemplateParamValueList {
  values: TemplateParamValue[] = [];

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateParamValueList?.(this) ?? null;
  }
}

export class TemplateParamValue {

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateParamValue?.(this) ?? null;
  }
}

export class TemplateParamTypeValue extends TemplateParamValue {
  value: DataType | null = null;

  constructor(value: DataType | null = null) {
    super();
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateParamTypeValue?.(this) ?? null;
  }
}

export class TemplateParamExprValue extends TemplateParamValue {
  value: Expr | null = null;

  constructor(value: Expr | null = null) {
    super();
    this.value = value;
  }

  accept<T>(visitor: ASTVisitor<T>): T | null {
    return visitor.visitTemplateParamExprValue?.(this) ?? null;
  }
}

