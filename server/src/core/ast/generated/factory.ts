// Auto-generated - DO NOT EDIT

import * as cls from './classes';
import * as enums from './enums';
import * as flags from './flags';

export class ASTFactory {
  mkScopeChild(): cls.ScopeChild {
    return new cls.ScopeChild();
  }

  mkSymbolChild(): cls.SymbolChild {
    return new cls.SymbolChild();
  }

  mkSymbolChildrenScope(name: string): cls.SymbolChildrenScope {
    return new cls.SymbolChildrenScope(name);
  }

  mkSymbolScope(): cls.SymbolScope {
    return new cls.SymbolScope();
  }

  mkActivityDecl(): cls.ActivityDecl {
    return new cls.ActivityDecl();
  }

  mkActivityStmt(): cls.ActivityStmt {
    return new cls.ActivityStmt();
  }

  mkActivitySchedulingConstraint(is_parallel: boolean): cls.ActivitySchedulingConstraint {
    return new cls.ActivitySchedulingConstraint(is_parallel);
  }

  mkActivityBindStmt(lhs: cls.ExprHierarchicalId | null): cls.ActivityBindStmt {
    return new cls.ActivityBindStmt(lhs);
  }

  mkActivityConstraint(constraint: cls.ConstraintStmt | null): cls.ActivityConstraint {
    return new cls.ActivityConstraint(constraint);
  }

  mkActivityLabeledStmt(): cls.ActivityLabeledStmt {
    return new cls.ActivityLabeledStmt();
  }

  mkActivityActionHandleTraversal(target: cls.ExprRefPathContext | null, with_c: cls.ConstraintStmt | null): cls.ActivityActionHandleTraversal {
    return new cls.ActivityActionHandleTraversal(target, with_c);
  }

  mkActivityActionTypeTraversal(target: cls.DataTypeUserDefined | null, with_c: cls.ConstraintStmt | null): cls.ActivityActionTypeTraversal {
    return new cls.ActivityActionTypeTraversal(target, with_c);
  }

  mkActionFieldInitializer(path: cls.ExprHierarchicalId | null, value: cls.Expr | null): cls.ActionFieldInitializer {
    return new cls.ActionFieldInitializer(path, value);
  }

  mkActivityLabeledScope(): cls.ActivityLabeledScope {
    return new cls.ActivityLabeledScope();
  }

  mkActivitySequence(): cls.ActivitySequence {
    return new cls.ActivitySequence();
  }

  mkActivityJoinSpec(): cls.ActivityJoinSpec {
    return new cls.ActivityJoinSpec();
  }

  mkActivityJoinSpecBranch(): cls.ActivityJoinSpecBranch {
    return new cls.ActivityJoinSpecBranch();
  }

  mkActivityJoinSpecSelect(count: cls.Expr | null): cls.ActivityJoinSpecSelect {
    return new cls.ActivityJoinSpecSelect(count);
  }

  mkActivityJoinSpecNone(): cls.ActivityJoinSpecNone {
    return new cls.ActivityJoinSpecNone();
  }

  mkActivityJoinSpecFirst(count: cls.Expr | null): cls.ActivityJoinSpecFirst {
    return new cls.ActivityJoinSpecFirst(count);
  }

  mkActivityParallel(join_spec: cls.ActivityJoinSpec | null): cls.ActivityParallel {
    return new cls.ActivityParallel(join_spec);
  }

  mkActivitySchedule(join_spec: cls.ActivityJoinSpec | null): cls.ActivitySchedule {
    return new cls.ActivitySchedule(join_spec);
  }

  mkActivityRepeatCount(loop_var: cls.ExprId | null, count: cls.Expr | null, body: cls.ScopeChild | null): cls.ActivityRepeatCount {
    return new cls.ActivityRepeatCount(loop_var, count, body);
  }

  mkActivityRepeatWhile(cond: cls.Expr | null, body: cls.ScopeChild | null): cls.ActivityRepeatWhile {
    return new cls.ActivityRepeatWhile(cond, body);
  }

  mkActivityForeach(it_id: cls.ExprId | null, idx_id: cls.ExprId | null, target: cls.ExprRefPathContext | null, body: cls.ScopeChild | null): cls.ActivityForeach {
    return new cls.ActivityForeach(it_id, idx_id, target, body);
  }

  mkActivitySelect(): cls.ActivitySelect {
    return new cls.ActivitySelect();
  }

  mkActivitySelectBranch(guard: cls.Expr | null, weight: cls.Expr | null, body: cls.ScopeChild | null): cls.ActivitySelectBranch {
    return new cls.ActivitySelectBranch(guard, weight, body);
  }

  mkActivityIfElse(cond: cls.Expr | null, true_s: cls.ActivityStmt | null, false_s: cls.ActivityStmt | null): cls.ActivityIfElse {
    return new cls.ActivityIfElse(cond, true_s, false_s);
  }

  mkActivityMatch(cond: cls.Expr | null): cls.ActivityMatch {
    return new cls.ActivityMatch(cond);
  }

  mkActivityMatchChoice(is_default: boolean, cond: cls.ExprOpenRangeList | null, body: cls.ScopeChild | null): cls.ActivityMatchChoice {
    return new cls.ActivityMatchChoice(is_default, cond, body);
  }

  mkActivityReplicate(idx_id: cls.ExprId | null, it_label: cls.ExprId | null, body: cls.ScopeChild | null): cls.ActivityReplicate {
    return new cls.ActivityReplicate(idx_id, it_label, body);
  }

  mkActivitySuper(): cls.ActivitySuper {
    return new cls.ActivitySuper();
  }

  mkActivityAtomicBlock(body: cls.ScopeChild | null): cls.ActivityAtomicBlock {
    return new cls.ActivityAtomicBlock(body);
  }

  mkAnnotation(type: cls.TypeIdentifier | null): cls.Annotation {
    return new cls.Annotation(type);
  }

  mkAnnotationParam(value: cls.Expr | null): cls.AnnotationParam {
    return new cls.AnnotationParam(value);
  }

  mkScope(): cls.Scope {
    return new cls.Scope();
  }

  mkNamedScope(name: cls.ExprId | null): cls.NamedScope {
    return new cls.NamedScope(name);
  }

  mkTypeScope(super_t: cls.TypeIdentifier | null): cls.TypeScope {
    return new cls.TypeScope(super_t);
  }

  mkAnnotationDecl(): cls.AnnotationDecl {
    return new cls.AnnotationDecl();
  }

  mkGenericConstraintParam(): cls.GenericConstraintParam {
    return new cls.GenericConstraintParam();
  }

  mkGenericConstraintDeclBool(): cls.GenericConstraintDeclBool {
    return new cls.GenericConstraintDeclBool();
  }

  mkGenericConstraintDeclValue(): cls.GenericConstraintDeclValue {
    return new cls.GenericConstraintDeclValue();
  }

  mkConstraintBlock(): cls.ConstraintBlock {
    return new cls.ConstraintBlock();
  }

  mkConstraintScope(): cls.ConstraintScope {
    return new cls.ConstraintScope();
  }

  mkConstraintSymbolScope(): cls.ConstraintSymbolScope {
    return new cls.ConstraintSymbolScope();
  }

  mkConstraintStmt(): cls.ConstraintStmt {
    return new cls.ConstraintStmt();
  }

  mkConstraintStmtExpr(): cls.ConstraintStmtExpr {
    return new cls.ConstraintStmtExpr();
  }

  mkConstraintStmtForeach(): cls.ConstraintStmtForeach {
    return new cls.ConstraintStmtForeach();
  }

  mkConstraintStmtField(): cls.ConstraintStmtField {
    return new cls.ConstraintStmtField();
  }

  mkConstraintStmtForall(): cls.ConstraintStmtForall {
    return new cls.ConstraintStmtForall();
  }

  mkConstraintStmtIf(): cls.ConstraintStmtIf {
    return new cls.ConstraintStmtIf();
  }

  mkConstraintStmtImplication(): cls.ConstraintStmtImplication {
    return new cls.ConstraintStmtImplication();
  }

  mkConstraintStmtUnique(): cls.ConstraintStmtUnique {
    return new cls.ConstraintStmtUnique();
  }

  mkConstraintStmtDefault(): cls.ConstraintStmtDefault {
    return new cls.ConstraintStmtDefault();
  }

  mkConstraintStmtDefaultDisable(): cls.ConstraintStmtDefaultDisable {
    return new cls.ConstraintStmtDefaultDisable();
  }

  mkAssocData(): cls.AssocData {
    return new cls.AssocData();
  }

  mkScopeChildRef(target: cls.ScopeChild | null): cls.ScopeChildRef {
    return new cls.ScopeChildRef(target);
  }

  mkGlobalScope(fileid: number): cls.GlobalScope {
    return new cls.GlobalScope(fileid);
  }

  mkNamedScopeChild(name: cls.ExprId | null): cls.NamedScopeChild {
    return new cls.NamedScopeChild(name);
  }

  mkPackageScope(): cls.PackageScope {
    return new cls.PackageScope();
  }

  mkPackageImportStmt(wildcard: boolean, alias: cls.ExprId | null): cls.PackageImportStmt {
    return new cls.PackageImportStmt(wildcard, alias);
  }

  mkPyImportStmt(): cls.PyImportStmt {
    return new cls.PyImportStmt();
  }

  mkPyImportFromStmt(): cls.PyImportFromStmt {
    return new cls.PyImportFromStmt();
  }

  mkAction(is_abstract: boolean): cls.Action {
    return new cls.Action(is_abstract);
  }

  mkComponent(): cls.Component {
    return new cls.Component();
  }

  mkDataType(): cls.DataType {
    return new cls.DataType();
  }

  mkDataTypeBool(): cls.DataTypeBool {
    return new cls.DataTypeBool();
  }

  mkDataTypeChandle(): cls.DataTypeChandle {
    return new cls.DataTypeChandle();
  }

  mkDataTypeEnum(tid: cls.DataTypeUserDefined | null, in_rangelist: cls.ExprOpenRangeList | null): cls.DataTypeEnum {
    return new cls.DataTypeEnum(tid, in_rangelist);
  }

  mkEnumItem(value: cls.Expr | null): cls.EnumItem {
    return new cls.EnumItem(value);
  }

  mkEnumDecl(): cls.EnumDecl {
    return new cls.EnumDecl();
  }

  mkDataTypeInt(is_signed: boolean, width: cls.Expr | null, in_range: cls.ExprDomainOpenRangeList | null): cls.DataTypeInt {
    return new cls.DataTypeInt(is_signed, width, in_range);
  }

  mkDataTypePyObj(): cls.DataTypePyObj {
    return new cls.DataTypePyObj();
  }

  mkDataTypeRef(type: cls.DataTypeUserDefined | null): cls.DataTypeRef {
    return new cls.DataTypeRef(type);
  }

  mkDataTypeString(has_range: boolean): cls.DataTypeString {
    return new cls.DataTypeString(has_range);
  }

  mkDataTypeUserDefined(is_global: boolean, type_id: cls.TypeIdentifier | null): cls.DataTypeUserDefined {
    return new cls.DataTypeUserDefined(is_global, type_id);
  }

  mkTypedefDeclaration(name: cls.ExprId | null, type: cls.DataType | null): cls.TypedefDeclaration {
    return new cls.TypedefDeclaration(name, type);
  }

  mkExecStmt(): cls.ExecStmt {
    return new cls.ExecStmt();
  }

  mkExecScope(): cls.ExecScope {
    return new cls.ExecScope();
  }

  mkExecBlock(kind: enums.ExecKind): cls.ExecBlock {
    return new cls.ExecBlock(kind);
  }

  mkExecTargetTemplateBlock(kind: enums.ExecKind, data: string): cls.ExecTargetTemplateBlock {
    return new cls.ExecTargetTemplateBlock(kind, data);
  }

  mkExecTargetTemplateParam(expr: cls.Expr | null, start: number, end: number): cls.ExecTargetTemplateParam {
    return new cls.ExecTargetTemplateParam(expr, start, end);
  }

  mkProceduralStmtAssignment(lhs: cls.Expr | null, op: enums.AssignOp, rhs: cls.Expr | null): cls.ProceduralStmtAssignment {
    return new cls.ProceduralStmtAssignment(lhs, op, rhs);
  }

  mkProceduralStmtExpr(expr: cls.Expr | null): cls.ProceduralStmtExpr {
    return new cls.ProceduralStmtExpr(expr);
  }

  mkProceduralStmtFunctionCall(prefix: cls.ExprRefPathStaticRooted | null): cls.ProceduralStmtFunctionCall {
    return new cls.ProceduralStmtFunctionCall(prefix);
  }

  mkProceduralStmtReturn(expr: cls.Expr | null): cls.ProceduralStmtReturn {
    return new cls.ProceduralStmtReturn(expr);
  }

  mkProceduralStmtSymbolBodyScope(body: cls.ScopeChild | null): cls.ProceduralStmtSymbolBodyScope {
    return new cls.ProceduralStmtSymbolBodyScope(body);
  }

  mkProceduralStmtRepeat(it_id: cls.ExprId | null, count: cls.Expr | null): cls.ProceduralStmtRepeat {
    return new cls.ProceduralStmtRepeat(it_id, count);
  }

  mkProceduralStmtBody(body: cls.ScopeChild | null): cls.ProceduralStmtBody {
    return new cls.ProceduralStmtBody(body);
  }

  mkProceduralStmtRepeatWhile(expr: cls.Expr | null): cls.ProceduralStmtRepeatWhile {
    return new cls.ProceduralStmtRepeatWhile(expr);
  }

  mkProceduralStmtWhile(expr: cls.Expr | null): cls.ProceduralStmtWhile {
    return new cls.ProceduralStmtWhile(expr);
  }

  mkProceduralStmtForeach(path: cls.ExprRefPath | null, it_id: cls.ExprId | null, idx_id: cls.ExprId | null): cls.ProceduralStmtForeach {
    return new cls.ProceduralStmtForeach(path, it_id, idx_id);
  }

  mkProceduralStmtIfClause(cond: cls.Expr | null, body: cls.ScopeChild | null): cls.ProceduralStmtIfClause {
    return new cls.ProceduralStmtIfClause(cond, body);
  }

  mkProceduralStmtIfElse(): cls.ProceduralStmtIfElse {
    return new cls.ProceduralStmtIfElse();
  }

  mkProceduralStmtMatch(expr: cls.Expr | null): cls.ProceduralStmtMatch {
    return new cls.ProceduralStmtMatch(expr);
  }

  mkProceduralStmtMatchChoice(is_default: boolean, cond: cls.ExprOpenRangeList | null, body: cls.ScopeChild | null): cls.ProceduralStmtMatchChoice {
    return new cls.ProceduralStmtMatchChoice(is_default, cond, body);
  }

  mkProceduralStmtBreak(): cls.ProceduralStmtBreak {
    return new cls.ProceduralStmtBreak();
  }

  mkProceduralStmtContinue(): cls.ProceduralStmtContinue {
    return new cls.ProceduralStmtContinue();
  }

  mkProceduralStmtDataDeclaration(name: cls.ExprId | null, datatype: cls.DataType | null, init: cls.Expr | null): cls.ProceduralStmtDataDeclaration {
    return new cls.ProceduralStmtDataDeclaration(name, datatype, init);
  }

  mkProceduralStmtYield(): cls.ProceduralStmtYield {
    return new cls.ProceduralStmtYield();
  }

  mkProceduralStmtRandomize(target: cls.Expr | null): cls.ProceduralStmtRandomize {
    return new cls.ProceduralStmtRandomize(target);
  }

  mkExpr(): cls.Expr {
    return new cls.Expr();
  }

  mkExprAggrLiteral(): cls.ExprAggrLiteral {
    return new cls.ExprAggrLiteral();
  }

  mkExprAggrEmpty(): cls.ExprAggrEmpty {
    return new cls.ExprAggrEmpty();
  }

  mkExprAggrList(): cls.ExprAggrList {
    return new cls.ExprAggrList();
  }

  mkExprAggrMapElem(lhs: cls.Expr | null, rhs: cls.Expr | null): cls.ExprAggrMapElem {
    return new cls.ExprAggrMapElem(lhs, rhs);
  }

  mkExprAggrMap(): cls.ExprAggrMap {
    return new cls.ExprAggrMap();
  }

  mkExprAggrStructElem(name: cls.ExprId | null, value: cls.Expr | null): cls.ExprAggrStructElem {
    return new cls.ExprAggrStructElem(name, value);
  }

  mkExprAggrStruct(): cls.ExprAggrStruct {
    return new cls.ExprAggrStruct();
  }

  mkExprBin(lhs: cls.Expr | null, op: enums.ExprBinOp, rhs: cls.Expr | null): cls.ExprBin {
    return new cls.ExprBin(lhs, op, rhs);
  }

  mkExprBitSlice(lhs: cls.Expr | null, rhs: cls.Expr | null): cls.ExprBitSlice {
    return new cls.ExprBitSlice(lhs, rhs);
  }

  mkExprBool(value: boolean): cls.ExprBool {
    return new cls.ExprBool(value);
  }

  mkExprCast(casting_type: cls.DataType | null, expr: cls.Expr | null): cls.ExprCast {
    return new cls.ExprCast(casting_type, expr);
  }

  mkExprCompileHas(ref: cls.ExprRefPathStatic | null): cls.ExprCompileHas {
    return new cls.ExprCompileHas(ref);
  }

  mkExprCond(cond_e: cls.Expr | null, true_e: cls.Expr | null, false_e: cls.Expr | null): cls.ExprCond {
    return new cls.ExprCond(cond_e, true_e, false_e);
  }

  mkExprDomainOpenRangeList(): cls.ExprDomainOpenRangeList {
    return new cls.ExprDomainOpenRangeList();
  }

  mkExprDomainOpenRangeValue(single: boolean, lhs: cls.Expr | null, rhs: cls.Expr | null): cls.ExprDomainOpenRangeValue {
    return new cls.ExprDomainOpenRangeValue(single, lhs, rhs);
  }

  mkExprHierarchicalId(): cls.ExprHierarchicalId {
    return new cls.ExprHierarchicalId();
  }

  mkExprId(id: string, is_escaped: boolean): cls.ExprId {
    return new cls.ExprId(id, is_escaped);
  }

  mkExprIn(lhs: cls.Expr | null, rhs: cls.ExprOpenRangeList | null): cls.ExprIn {
    return new cls.ExprIn(lhs, rhs);
  }

  mkExprListLiteral(): cls.ExprListLiteral {
    return new cls.ExprListLiteral();
  }

  mkExprStructLiteral(): cls.ExprStructLiteral {
    return new cls.ExprStructLiteral();
  }

  mkExprStructLiteralItem(id: cls.ExprId | null, value: cls.Expr | null): cls.ExprStructLiteralItem {
    return new cls.ExprStructLiteralItem(id, value);
  }

  mkExprMemberPathElem(id: cls.ExprId | null, params: cls.MethodParameterList | null): cls.ExprMemberPathElem {
    return new cls.ExprMemberPathElem(id, params);
  }

  mkExprNull(): cls.ExprNull {
    return new cls.ExprNull();
  }

  mkExprNumber(): cls.ExprNumber {
    return new cls.ExprNumber();
  }

  mkExprOpenRangeList(): cls.ExprOpenRangeList {
    return new cls.ExprOpenRangeList();
  }

  mkExprOpenRangeValue(lhs: cls.Expr | null, rhs: cls.Expr | null): cls.ExprOpenRangeValue {
    return new cls.ExprOpenRangeValue(lhs, rhs);
  }

  mkExprRefPath(): cls.ExprRefPath {
    return new cls.ExprRefPath();
  }

  mkExprRefPathId(id: cls.ExprId | null): cls.ExprRefPathId {
    return new cls.ExprRefPathId(id);
  }

  mkExprRefPathContext(hier_id: cls.ExprHierarchicalId | null): cls.ExprRefPathContext {
    return new cls.ExprRefPathContext(hier_id);
  }

  mkExprRefPathElem(): cls.ExprRefPathElem {
    return new cls.ExprRefPathElem();
  }

  mkExprRefPathStatic(is_global: boolean): cls.ExprRefPathStatic {
    return new cls.ExprRefPathStatic(is_global);
  }

  mkExprRefPathStaticFunc(params: cls.MethodParameterList | null): cls.ExprRefPathStaticFunc {
    return new cls.ExprRefPathStaticFunc(params);
  }

  mkExprRefPathStaticRooted(root: cls.ExprRefPathStatic | null, leaf: cls.ExprHierarchicalId | null): cls.ExprRefPathStaticRooted {
    return new cls.ExprRefPathStaticRooted(root, leaf);
  }

  mkExprRefPathSuper(): cls.ExprRefPathSuper {
    return new cls.ExprRefPathSuper();
  }

  mkExprSignedNumber(image: string, width: number, value: number): cls.ExprSignedNumber {
    return new cls.ExprSignedNumber(image, width, value);
  }

  mkExprStaticRefPath(is_global: boolean, leaf: cls.ExprMemberPathElem | null): cls.ExprStaticRefPath {
    return new cls.ExprStaticRefPath(is_global, leaf);
  }

  mkExprString(value: string, is_raw: boolean): cls.ExprString {
    return new cls.ExprString(value, is_raw);
  }

  mkExprSubstring(expr: cls.Expr | null, start: cls.Expr | null, end: cls.Expr | null): cls.ExprSubstring {
    return new cls.ExprSubstring(expr, start, end);
  }

  mkExprSubscript(expr: cls.Expr | null, subscript: cls.Expr | null): cls.ExprSubscript {
    return new cls.ExprSubscript(expr, subscript);
  }

  mkExprUnary(op: enums.ExprUnaryOp, rhs: cls.Expr | null): cls.ExprUnary {
    return new cls.ExprUnary(op, rhs);
  }

  mkExprUnsignedNumber(image: string, width: number, value: number): cls.ExprUnsignedNumber {
    return new cls.ExprUnsignedNumber(image, width, value);
  }

  mkMethodParameterList(): cls.MethodParameterList {
    return new cls.MethodParameterList();
  }

  mkTypeIdentifier(): cls.TypeIdentifier {
    return new cls.TypeIdentifier();
  }

  mkTypeIdentifierElem(id: cls.ExprId | null, params: cls.TemplateParamValueList | null): cls.TypeIdentifierElem {
    return new cls.TypeIdentifierElem(id, params);
  }

  mkExtendType(kind: enums.ExtendTargetE, target: cls.TypeIdentifier | null): cls.ExtendType {
    return new cls.ExtendType(kind, target);
  }

  mkExtendEnum(target: cls.TypeIdentifier | null): cls.ExtendEnum {
    return new cls.ExtendEnum(target);
  }

  mkField(type: cls.DataType | null, attr: flags.FieldAttr, init: cls.Expr | null): cls.Field {
    return new cls.Field(type, attr, init);
  }

  mkFieldCompRef(type: cls.DataTypeUserDefined | null): cls.FieldCompRef {
    return new cls.FieldCompRef(type);
  }

  mkFieldRef(type: cls.DataTypeUserDefined | null, is_input: boolean): cls.FieldRef {
    return new cls.FieldRef(type, is_input);
  }

  mkFieldClaim(type: cls.DataTypeUserDefined | null, is_lock: boolean): cls.FieldClaim {
    return new cls.FieldClaim(type, is_lock);
  }

  mkActionHandleField(type: cls.DataType | null): cls.ActionHandleField {
    return new cls.ActionHandleField(type);
  }

  mkFunctionDefinition(proto: cls.FunctionPrototype | null, body: cls.ExecScope | null, plat: enums.PlatQual): cls.FunctionDefinition {
    return new cls.FunctionDefinition(proto, body, plat);
  }

  mkFunctionParamDecl(kind: enums.FunctionParamDeclKind, name: cls.ExprId | null, type: cls.DataType | null, dir: enums.ParamDir, dflt: cls.Expr | null): cls.FunctionParamDecl {
    return new cls.FunctionParamDecl(kind, name, type, dir, dflt);
  }

  mkFunctionPrototype(rtype: cls.DataType | null, is_target: boolean, is_solve: boolean): cls.FunctionPrototype {
    return new cls.FunctionPrototype(rtype, is_target, is_solve);
  }

  mkFunctionImport(plat: enums.PlatQual, lang: string): cls.FunctionImport {
    return new cls.FunctionImport(plat, lang);
  }

  mkFunctionImportType(type: cls.TypeIdentifier | null): cls.FunctionImportType {
    return new cls.FunctionImportType(type);
  }

  mkFunctionImportProto(proto: cls.FunctionPrototype | null): cls.FunctionImportProto {
    return new cls.FunctionImportProto(proto);
  }

  mkExportFunction(plat: enums.PlatQual, name: cls.ExprId | null): cls.ExportFunction {
    return new cls.ExportFunction(plat, name);
  }

  mkSymbolScopeRef(name: string): cls.SymbolScopeRef {
    return new cls.SymbolScopeRef(name);
  }

  mkRootSymbolScope(): cls.RootSymbolScope {
    return new cls.RootSymbolScope();
  }

  mkSymbolEnumScope(): cls.SymbolEnumScope {
    return new cls.SymbolEnumScope();
  }

  mkSymbolExtendScope(): cls.SymbolExtendScope {
    return new cls.SymbolExtendScope();
  }

  mkSymbolImportSpec(): cls.SymbolImportSpec {
    return new cls.SymbolImportSpec();
  }

  mkSymbolTypeScope(plist: cls.SymbolScope | null): cls.SymbolTypeScope {
    return new cls.SymbolTypeScope(plist);
  }

  mkSymbolFunctionScope(): cls.SymbolFunctionScope {
    return new cls.SymbolFunctionScope();
  }

  mkSymbolRefPath(): cls.SymbolRefPath {
    return new cls.SymbolRefPath();
  }

  mkMonitor(): cls.Monitor {
    return new cls.Monitor();
  }

  mkMonitorActivityStmt(): cls.MonitorActivityStmt {
    return new cls.MonitorActivityStmt();
  }

  mkMonitorActivityDecl(): cls.MonitorActivityDecl {
    return new cls.MonitorActivityDecl();
  }

  mkMonitorActivitySequence(): cls.MonitorActivitySequence {
    return new cls.MonitorActivitySequence();
  }

  mkMonitorActivityConcat(lhs: cls.MonitorActivityStmt | null, rhs: cls.MonitorActivityStmt | null): cls.MonitorActivityConcat {
    return new cls.MonitorActivityConcat(lhs, rhs);
  }

  mkMonitorActivityEventually(condition: cls.Expr | null, body: cls.MonitorActivityStmt | null): cls.MonitorActivityEventually {
    return new cls.MonitorActivityEventually(condition, body);
  }

  mkMonitorActivityOverlap(lhs: cls.MonitorActivityStmt | null, rhs: cls.MonitorActivityStmt | null): cls.MonitorActivityOverlap {
    return new cls.MonitorActivityOverlap(lhs, rhs);
  }

  mkMonitorActivitySchedule(): cls.MonitorActivitySchedule {
    return new cls.MonitorActivitySchedule();
  }

  mkMonitorActivitySelect(): cls.MonitorActivitySelect {
    return new cls.MonitorActivitySelect();
  }

  mkMonitorActivitySelectBranch(guard: cls.Expr | null, body: cls.ScopeChild | null): cls.MonitorActivitySelectBranch {
    return new cls.MonitorActivitySelectBranch(guard, body);
  }

  mkMonitorActivityActionTraversal(target: cls.ExprRefPath | null, with_c: cls.ConstraintStmt | null): cls.MonitorActivityActionTraversal {
    return new cls.MonitorActivityActionTraversal(target, with_c);
  }

  mkMonitorActivityMonitorTraversal(target: cls.ExprRefPath | null, with_c: cls.ConstraintStmt | null): cls.MonitorActivityMonitorTraversal {
    return new cls.MonitorActivityMonitorTraversal(target, with_c);
  }

  mkMonitorConstraint(constraint: cls.ConstraintStmt | null): cls.MonitorConstraint {
    return new cls.MonitorConstraint(constraint);
  }

  mkMonitorActivityRepeatCount(loop_var: cls.ExprId | null, count: cls.Expr | null, body: cls.ScopeChild | null): cls.MonitorActivityRepeatCount {
    return new cls.MonitorActivityRepeatCount(loop_var, count, body);
  }

  mkMonitorActivityRepeatWhile(cond: cls.Expr | null, body: cls.ScopeChild | null): cls.MonitorActivityRepeatWhile {
    return new cls.MonitorActivityRepeatWhile(cond, body);
  }

  mkMonitorActivityIfElse(cond: cls.Expr | null, true_s: cls.MonitorActivityStmt | null, false_s: cls.MonitorActivityStmt | null): cls.MonitorActivityIfElse {
    return new cls.MonitorActivityIfElse(cond, true_s, false_s);
  }

  mkMonitorActivityMatch(cond: cls.Expr | null): cls.MonitorActivityMatch {
    return new cls.MonitorActivityMatch(cond);
  }

  mkMonitorActivityMatchChoice(is_default: boolean, cond: cls.ExprOpenRangeList | null, body: cls.ScopeChild | null): cls.MonitorActivityMatchChoice {
    return new cls.MonitorActivityMatchChoice(is_default, cond, body);
  }

  mkCoverStmtInline(body: cls.ScopeChild | null): cls.CoverStmtInline {
    return new cls.CoverStmtInline(body);
  }

  mkCoverStmtReference(target: cls.ExprRefPath | null): cls.CoverStmtReference {
    return new cls.CoverStmtReference(target);
  }

  mkRefExpr(): cls.RefExpr {
    return new cls.RefExpr();
  }

  mkRefExprTypeScopeGlobal(fileid: number): cls.RefExprTypeScopeGlobal {
    return new cls.RefExprTypeScopeGlobal(fileid);
  }

  mkRefExprTypeScopeContext(base: cls.RefExpr | null, offset: number): cls.RefExprTypeScopeContext {
    return new cls.RefExprTypeScopeContext(base, offset);
  }

  mkRefExprScopeIndex(base: cls.RefExpr | null, offset: number): cls.RefExprScopeIndex {
    return new cls.RefExprScopeIndex(base, offset);
  }

  mkStruct(kind: enums.StructKind): cls.Struct {
    return new cls.Struct(kind);
  }

  mkTemplateParamDeclList(): cls.TemplateParamDeclList {
    return new cls.TemplateParamDeclList();
  }

  mkTemplateParamDecl(name: cls.ExprId | null): cls.TemplateParamDecl {
    return new cls.TemplateParamDecl(name);
  }

  mkTemplateGenericTypeParamDecl(dflt: cls.DataType | null): cls.TemplateGenericTypeParamDecl {
    return new cls.TemplateGenericTypeParamDecl(dflt);
  }

  mkTemplateCategoryTypeParamDecl(category: enums.TypeCategory, restriction: cls.TypeIdentifier | null, dflt: cls.DataType | null): cls.TemplateCategoryTypeParamDecl {
    return new cls.TemplateCategoryTypeParamDecl(category, restriction, dflt);
  }

  mkTemplateValueParamDecl(type: cls.DataType | null, dflt: cls.Expr | null): cls.TemplateValueParamDecl {
    return new cls.TemplateValueParamDecl(type, dflt);
  }

  mkTemplateParamValueList(): cls.TemplateParamValueList {
    return new cls.TemplateParamValueList();
  }

  mkTemplateParamValue(): cls.TemplateParamValue {
    return new cls.TemplateParamValue();
  }

  mkTemplateParamTypeValue(value: cls.DataType | null): cls.TemplateParamTypeValue {
    return new cls.TemplateParamTypeValue(value);
  }

  mkTemplateParamExprValue(value: cls.Expr | null): cls.TemplateParamExprValue {
    return new cls.TemplateParamExprValue(value);
  }

}
