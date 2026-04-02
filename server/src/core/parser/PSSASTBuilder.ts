import { ParserRuleContext, CommonTokenStream } from 'antlr4ng';
import * as P from '../../generated/PSSParser.js';
import * as AST from '../ast/generated';
import { Location, mkLocation } from '../ast/generated/structs';
import { DocCommentHarvester } from './DocCommentHarvester';

/**
 * ANTLR visitor that walks a parse tree and produces a typed AST.
 * Covers compilation_unit, package, component, action, struct, enum,
 * fields, data types, activity statements, exec blocks, constraints,
 * monitors, expressions, imports, extends, typedefs, annotations, etc.
 */
export class PSSASTBuilder {
  private fileId: number;
  private harvester: DocCommentHarvester;

  constructor(fileId: number, tokens: CommonTokenStream) {
    this.fileId = fileId;
    this.harvester = new DocCommentHarvester(tokens);
  }

  // ── Entry ──────────────────────────────────────────────────────
  public build(tree: P.Compilation_unitContext): AST.GlobalScope {
    const gs = new AST.GlobalScope();
    gs.fileid = this.fileId;
    gs.location = this.loc(tree);
    for (const desc of arr(tree.portable_stimulus_description())) {
      const itemAnn = desc.package_body_item_ann();
      if (itemAnn) this.addChild(gs, this.visitPkgBodyItemAnn(itemAnn));
    }
    return gs;
  }

  // ── Package-level items ────────────────────────────────────────
  private visitPkgBodyItemAnn(ctx: P.Package_body_item_annContext): AST.ScopeChild | AST.ScopeChild[] | null {
    const b = ctx.package_body_item();
    return b ? this.visitPkgBodyItem(b) : null;
  }

  private visitPkgBodyItem(ctx: P.Package_body_itemContext): AST.ScopeChild | AST.ScopeChild[] | null {
    if (ctx.abstract_action_declaration()) return this.visitAbstractAction(ctx.abstract_action_declaration()!);
    if (ctx.struct_declaration()) return this.visitStruct(ctx.struct_declaration()!);
    if (ctx.component_declaration()) return this.visitComponent(ctx.component_declaration()!);
    if (ctx.enum_declaration()) return this.visitEnum(ctx.enum_declaration()!);
    if (ctx.package_declaration()) return this.visitPackage(ctx.package_declaration()!);
    if (ctx.import_stmt()) return this.visitImport(ctx.import_stmt()!);
    if (ctx.extend_stmt()) return this.visitExtend(ctx.extend_stmt()!);
    if (ctx.typedef_declaration()) return this.visitTypedef(ctx.typedef_declaration()!);
    if (ctx.function_decl()) return this.visitFuncDecl(ctx.function_decl()!);
    if (ctx.const_field_declaration()) return this.visitConstField(ctx.const_field_declaration()!);
    if (ctx.annotation_declaration()) return this.visitAnnotation(ctx.annotation_declaration()!);
    if (ctx.covergroup_declaration()) return this.visitCovergroup(ctx.covergroup_declaration()!);
    if (ctx.generic_constraint_declaration()) return this.visitGenericConstraint(ctx.generic_constraint_declaration()!);
    if (ctx.pyimport_stmt()) return this.visitPyimport(ctx.pyimport_stmt()!);
    if (ctx.export_action()) return this.visitExportAction(ctx.export_action()!);
    if (ctx.procedural_function?.()) return this.visitProceduralFunction(ctx.procedural_function()!);
    return null;
  }

  // ── Package ────────────────────────────────────────────────────
  private visitPackage(ctx: P.Package_declarationContext): AST.PackageScope {
    const pkg = new AST.PackageScope();
    pkg.location = this.loc(ctx);
    pkg.docstring = this.doc(ctx);
    const idPath = ctx.package_id_path();
    if (idPath) for (const id of arr(idPath.package_identifier())) pkg.id.push(this.mkId(id));
    for (const ann of arr(ctx.package_body_item_ann())) this.addChild(pkg, this.visitPkgBodyItemAnn(ann));
    return pkg;
  }

  // ── Action ─────────────────────────────────────────────────────
  private visitAbstractAction(ctx: P.Abstract_action_declarationContext): AST.Action {
    const aCtx = ctx.action_declaration();
    if (!aCtx) { const a = new AST.Action(); a.is_abstract = true; a.location = this.loc(ctx); return a; }
    const a = this.visitAction(aCtx);
    a.is_abstract = true;
    a.location = this.loc(ctx);
    a.docstring = this.doc(ctx);
    return a;
  }

  private visitAction(ctx: P.Action_declarationContext): AST.Action {
    const a = new AST.Action();
    a.location = this.loc(ctx);
    a.docstring = this.doc(ctx);
    if (ctx.action_identifier()) a.name = this.mkId(ctx.action_identifier()!);
    const ss = ctx.action_super_spec();
    if (ss?.type_identifier()) a.super_t = this.visitTypeId(ss.type_identifier()!);
    if (ctx.template_param_decl_list()) a.params = this.mkTplParams(ctx.template_param_decl_list()!);
    for (const ann of arr(ctx.action_body_item_ann())) {
      const bi = ann.action_body_item();
      if (bi) this.addChild(a, this.visitActionBodyItem(bi));
    }
    return a;
  }

  private visitActionBodyItem(ctx: P.Action_body_itemContext): AST.ScopeChild | AST.ScopeChild[] | null {
    if (ctx.activity_declaration()) return this.visitActivity(ctx.activity_declaration()!);
    if (ctx.constraint_declaration()) return this.visitConstraintDecl(ctx.constraint_declaration()!);
    if (ctx.action_field_declaration()) return this.visitActionField(ctx.action_field_declaration()!);
    if (ctx.exec_block_stmt?.()) return this.visitExecBlockStmt(ctx.exec_block_stmt()!);
    if (ctx.override_declaration?.()) return this.visitOverride(ctx.override_declaration()!);
    if (ctx.covergroup_declaration?.()) return this.visitCovergroup(ctx.covergroup_declaration()!);
    if (ctx.generic_constraint_declaration?.()) return this.visitGenericConstraint(ctx.generic_constraint_declaration()!);
    if (ctx.symbol_declaration?.()) return this.visitSymbolDecl(ctx.symbol_declaration()!);
    return null;
  }

  // ── Component ──────────────────────────────────────────────────
  private visitComponent(ctx: P.Component_declarationContext): AST.Component {
    const c = new AST.Component();
    c.location = this.loc(ctx);
    c.docstring = this.doc(ctx);
    if (ctx.component_identifier()) c.name = this.mkId(ctx.component_identifier()!);
    const ss = ctx.component_super_spec();
    if (ss?.type_identifier()) c.super_t = this.visitTypeId(ss.type_identifier()!);
    if (ctx.template_param_decl_list()) c.params = this.mkTplParams(ctx.template_param_decl_list()!);
    for (const ann of arr(ctx.component_body_item_ann())) {
      const bi = ann.component_body_item();
      if (bi) this.addChild(c, this.visitComponentBodyItem(bi));
    }
    return c;
  }

  private visitComponentBodyItem(ctx: P.Component_body_itemContext): AST.ScopeChild | AST.ScopeChild[] | null {
    if (ctx.action_declaration()) return this.visitAction(ctx.action_declaration()!);
    if (ctx.abstract_action_declaration()) return this.visitAbstractAction(ctx.abstract_action_declaration()!);
    if (ctx.override_action_declaration?.()) return this.visitOverrideAction(ctx.override_action_declaration()!);
    if (ctx.struct_declaration()) return this.visitStruct(ctx.struct_declaration()!);
    if (ctx.enum_declaration()) return this.visitEnum(ctx.enum_declaration()!);
    if (ctx.component_data_declaration()) {
      const dd = ctx.component_data_declaration()!.data_declaration();
      if (dd) return this.visitDataDecl(dd);
    }
    if (ctx.component_pool_declaration?.()) return this.visitPoolDecl(ctx.component_pool_declaration()!);
    if (ctx.object_bind_stmt?.()) return this.visitBindStmt(ctx.object_bind_stmt()!);
    if (ctx.exec_block?.()) return this.visitExecBlock(ctx.exec_block()!);
    if (ctx.attr_group?.()) return null; // access modifier group, not a declaration
    
    if (ctx.covergroup_declaration?.()) return this.visitCovergroup(ctx.covergroup_declaration()!);
    if (ctx.function_decl?.()) return this.visitFuncDecl(ctx.function_decl()!);
    if (ctx.typedef_declaration?.()) return this.visitTypedef(ctx.typedef_declaration()!);
    if (ctx.import_stmt?.()) return this.visitImport(ctx.import_stmt()!);
    if (ctx.extend_stmt?.()) return this.visitExtend(ctx.extend_stmt()!);
    return null;
  }

  // ── Struct ─────────────────────────────────────────────────────
  private visitStruct(ctx: P.Struct_declarationContext): AST.Struct {
    const s = new AST.Struct();
    s.location = this.loc(ctx);
    s.docstring = this.doc(ctx);
    const k = ctx.struct_kind();
    if (k) {
      if (k.TOK_STRUCT?.()) s.kind = AST.enums.StructKind.Struct;
      else {
        const ok = k.object_kind?.();
        if (ok?.TOK_BUFFER?.()) s.kind = AST.enums.StructKind.Buffer;
        else if (ok?.TOK_STREAM?.()) s.kind = AST.enums.StructKind.Stream;
        else if (ok?.TOK_STATE?.()) s.kind = AST.enums.StructKind.State;
        else if (ok?.TOK_RESOURCE?.()) s.kind = AST.enums.StructKind.Resource;
      }
    }
    if (ctx.identifier()) s.name = this.mkId(ctx.identifier()!);
    const ss = ctx.struct_super_spec();
    if (ss?.type_identifier()) s.super_t = this.visitTypeId(ss.type_identifier()!);
    if (ctx.template_param_decl_list()) s.params = this.mkTplParams(ctx.template_param_decl_list()!);
    for (const bi of arr(ctx.struct_body_item())) this.addChild(s, this.visitStructBodyItem(bi));
    return s;
  }

  private visitStructBodyItem(ctx: P.Struct_body_itemContext): AST.ScopeChild | AST.ScopeChild[] | null {
    if (ctx.attr_field()) return this.visitAttrField(ctx.attr_field()!);
    if (ctx.constraint_declaration()) return this.visitConstraintDecl(ctx.constraint_declaration()!);
    if (ctx.typedef_declaration()) return this.visitTypedef(ctx.typedef_declaration()!);
    if (ctx.exec_block_stmt?.()) return this.visitExecBlockStmt(ctx.exec_block_stmt()!);
    if (ctx.covergroup_declaration?.()) return this.visitCovergroup(ctx.covergroup_declaration()!);
    return null;
  }

  // ── Enum ───────────────────────────────────────────────────────
  private visitEnum(ctx: P.Enum_declarationContext): AST.EnumDecl {
    const e = new AST.EnumDecl();
    e.location = this.loc(ctx);
    e.docstring = this.doc(ctx);
    if (ctx.enum_identifier()) e.name = this.mkId(ctx.enum_identifier()!);
    // Parse enum items
    for (const itemCtx of arr(ctx.enum_item())) {
      const item = new AST.EnumItem();
      item.location = this.loc(itemCtx);
      if (itemCtx.identifier?.()) item.name = this.mkId(itemCtx.identifier()!);
      e.items.push(item);
    }
    return e;
  }

  // ── Monitor ────────────────────────────────────────────────────
  private visitMonitor(ctx: P.Monitor_declarationContext): AST.Monitor {
    const m = new AST.Monitor();
    m.location = this.loc(ctx);
    m.docstring = this.doc(ctx);
    if (ctx.monitor_identifier()) m.name = this.mkId(ctx.monitor_identifier()!);
    const ss = ctx.monitor_super_spec?.();
    if (ss?.type_identifier?.()) m.super_t = this.visitTypeId(ss.type_identifier()!);
    if (ctx.template_param_decl_list()) m.params = this.mkTplParams(ctx.template_param_decl_list()!);
    for (const bi of arr(ctx.monitor_body_item())) this.addChild(m, this.visitMonitorBodyItem(bi));
    return m;
  }

  private visitMonitorBodyItem(ctx: any): AST.ScopeChild | AST.ScopeChild[] | null {
    if (ctx.monitor_activity_declaration?.()) {
      const mad = new AST.MonitorActivityDecl();
      mad.location = this.loc(ctx);
      return mad;
    }
    if (ctx.monitor_field_declaration?.()) {
      const mfd = ctx.monitor_field_declaration();
      if (mfd.attr_field?.()) return this.visitAttrField(mfd.attr_field());
      if (mfd.action_handle_declaration?.()) return this.visitActionHandle(mfd.action_handle_declaration());
    }
    if (ctx.constraint_declaration?.()) return this.visitConstraintDecl(ctx.constraint_declaration());
    if (ctx.covergroup_declaration?.()) return this.visitCovergroup(ctx.covergroup_declaration());
    return null;
  }

  // ── Fields ─────────────────────────────────────────────────────
  private visitAttrField(ctx: P.Attr_fieldContext): AST.Field | AST.Field[] {
    const f = new AST.Field();
    f.location = this.loc(ctx);
    f.docstring = this.doc(ctx);
    if (ctx.access_modifier?.()) {
      const m = ctx.access_modifier()!;
      if (m.TOK_PROTECTED?.()) f.attr |= AST.flags.FieldAttr.Protected;
      else if (m.TOK_PRIVATE?.()) f.attr |= AST.flags.FieldAttr.Private;
    }
    if (ctx.TOK_RAND?.()) f.attr |= AST.flags.FieldAttr.Rand;
    if (ctx.TOK_STATIC?.()) f.attr |= AST.flags.FieldAttr.Static;
    if (ctx.TOK_CONST?.()) f.attr |= AST.flags.FieldAttr.Const;
    const dd = ctx.data_declaration();
    if (!dd) return f;
    const result = this.visitDataDecl(dd);
    if (Array.isArray(result)) {
      // Apply attributes from this context to all fields
      for (const field of result) {
        field.attr |= f.attr;
        field.docstring = field.docstring || f.docstring;
      }
      return result;
    }
    this.fillField(f, dd);
    return f;
  }

  private visitConstField(ctx: P.Const_field_declarationContext): AST.Field | AST.Field[] {
    const f = new AST.Field();
    f.location = this.loc(ctx);
    f.attr = AST.flags.FieldAttr.Const | AST.flags.FieldAttr.Static;
    f.docstring = this.doc(ctx);
    const dd = ctx.data_declaration();
    if (!dd) return f;
    const result = this.visitDataDecl(dd);
    if (Array.isArray(result)) {
      for (const field of result) {
        field.attr |= f.attr;
        field.docstring = field.docstring || f.docstring;
      }
      return result;
    }
    this.fillField(f, dd);
    return f;
  }

  private visitActionField(ctx: P.Action_field_declarationContext): AST.ScopeChild | AST.ScopeChild[] | null {
    if (ctx.attr_field()) return this.visitAttrField(ctx.attr_field()!);
    if (ctx.activity_data_field?.()) {
      // Activity data field: 'action' data_declaration
      const adf = ctx.activity_data_field()!;
      const dd = adf.data_declaration();
      if (dd) {
        const f = this.visitDataDecl(dd);
        if (Array.isArray(f)) {
          for (const field of f) {
            field.attr |= AST.flags.FieldAttr.Action;
            if (field.location.lineno < 0) field.location = this.loc(ctx);
          }
          return f;
        }
        f.attr |= AST.flags.FieldAttr.Action;
        f.location = this.loc(ctx);
        return f;
      }
    }
    if (ctx.object_ref_field_declaration?.()) {
      const orf = ctx.object_ref_field_declaration()!;
      if (orf.flow_ref_field_declaration()) return this.visitFlowRef(orf.flow_ref_field_declaration()!);
      if (orf.resource_ref_field_declaration()) return this.visitResourceRef(orf.resource_ref_field_declaration()!);
    }
    return null;
  }

  private visitFlowRef(ctx: any): AST.FieldRef {
    const fr = new AST.FieldRef();
    fr.location = this.loc(ctx);
    if (ctx.TOK_INPUT?.()) fr.is_input = true;
    const flowType = ctx.flow_object_type?.();
    if (flowType?.type_identifier?.()) fr.type = this.mkDTUserDefined(flowType.type_identifier());
    for (const orf of arr(ctx.object_ref_field?.())) {
      const id = orf.identifier?.();
      if (id) { fr.name = this.mkId(id); break; }
    }
    return fr;
  }

  private visitResourceRef(ctx: any): AST.FieldClaim {
    const fc = new AST.FieldClaim();
    fc.location = this.loc(ctx);
    fc.is_lock = !!ctx.TOK_LOCK?.();
    const resType = ctx.resource_object_type?.();
    if (resType?.resource_type_identifier?.()) {
      const rti = resType.resource_type_identifier();
      if (rti.type_identifier?.()) fc.type = this.mkDTUserDefined(rti.type_identifier());
    }
    for (const orf of arr(ctx.object_ref_field?.())) {
      const id = orf.identifier?.();
      if (id) { fc.name = this.mkId(id); break; }
    }
    return fc;
  }

  private visitActionHandle(ctx: P.Action_handle_declarationContext): AST.ActionHandleField {
    const ahf = new AST.ActionHandleField();
    ahf.location = this.loc(ctx);
    const ati = ctx.action_type_identifier?.();
    if (ati?.type_identifier?.()) ahf.type = this.mkDTUserDefined(ati.type_identifier());
    const instArr = arr(ctx.action_instantiation?.());
    if (instArr.length > 0) {
      const si = instArr[0].action_handle_single_instance?.();
      if (si?.action_identifier?.()) ahf.name = this.mkId(si.action_identifier());
    }
    return ahf;
  }

  private visitDataDecl(ctx: P.Data_declarationContext): AST.Field | AST.Field[] {
    const f = new AST.Field();
    f.location = this.loc(ctx);
    const type = ctx.data_type() ? this.visitDataType(ctx.data_type()!) : null;
    if (type) f.type = type;
    const insts = arr(ctx.data_instantiation());
    if (insts.length > 0) {
      const id = insts[0].identifier();
      if (id) f.name = this.mkId(id);
    }
    if (insts.length <= 1) return f;
    // Multiple declarators: e.g. mycomp_c c1, c2;
    const fields: AST.Field[] = [f];
    for (let i = 1; i < insts.length; i++) {
      const extra = new AST.Field();
      extra.location = this.loc(insts[i]);
      extra.type = type;
      extra.attr = f.attr;
      extra.docstring = f.docstring;
      const id = insts[i].identifier();
      if (id) extra.name = this.mkId(id);
      fields.push(extra);
    }
    return fields;
  }

  private fillField(f: AST.Field, ctx: P.Data_declarationContext): void {
    if (ctx.data_type()) f.type = this.visitDataType(ctx.data_type()!);
    const insts = arr(ctx.data_instantiation());
    if (insts.length > 0) {
      const id = insts[0].identifier();
      if (id) f.name = this.mkId(id);
    }
  }

  // ── Data Types ─────────────────────────────────────────────────
  private visitDataType(ctx: P.Data_typeContext): AST.ScopeChild | null {
    if (ctx.scalar_data_type()) return this.visitScalarDT(ctx.scalar_data_type()!);
    if (ctx.type_identifier?.()) return this.mkDTUserDefined(ctx.type_identifier()!);
    return null;
  }

  private visitScalarDT(ctx: P.Scalar_data_typeContext): AST.ScopeChild | null {
    if (ctx.integer_type()) {
      const dt = new AST.DataTypeInt();
      dt.location = this.loc(ctx);
      const at = ctx.integer_type()!.integer_atom_type?.();
      dt.is_signed = at?.getText() !== 'bit';
      return dt;
    }
    if (ctx.bool_type()) { const dt = new AST.DataTypeBool(); dt.location = this.loc(ctx); return dt; }
    if (ctx.string_type()) { const dt = new AST.DataTypeString(); dt.location = this.loc(ctx); return dt; }
    if (ctx.chandle_type()) { const dt = new AST.DataTypeChandle(); dt.location = this.loc(ctx); return dt; }
    if (ctx.enum_type()) { const dt = new AST.DataTypeEnum(); dt.location = this.loc(ctx); return dt; }
    if (ctx.float_type?.()) {
      // No specific Float32/Float64 classes, use DataType
      const dt = new AST.DataType(); dt.location = this.loc(ctx); return dt;
    }
    if (ctx.pyobj_type?.()) {
      const dt = new AST.DataTypePyObj(); dt.location = this.loc(ctx); return dt;
    }
    return null;
  }

  private mkDTUserDefined(ctx: P.Type_identifierContext): AST.DataTypeUserDefined {
    const dt = new AST.DataTypeUserDefined();
    dt.type_id = this.visitTypeId(ctx);
    return dt;
  }

  // ── Type Identifier ────────────────────────────────────────────
  private visitTypeId(ctx: P.Type_identifierContext): AST.TypeIdentifier {
    const ti = new AST.TypeIdentifier();
    for (const e of arr(ctx.type_identifier_elem())) {
      const tie = new AST.TypeIdentifierElem();
      if (e.identifier()) tie.id = this.mkId(e.identifier()!);
      ti.elems.push(tie);
    }
    return ti;
  }

  // ── Activity ───────────────────────────────────────────────────
  private visitActivity(ctx: P.Activity_declarationContext): AST.ActivityDecl {
    const ad = new AST.ActivityDecl();
    ad.location = this.loc(ctx);
    ad.docstring = this.doc(ctx);
    for (const ann of arr(ctx.activity_stmt_ann())) {
      const stmt = ann.activity_stmt?.();
      if (stmt) this.addChild(ad, this.visitActivityStmt(stmt));
    }
    return ad;
  }

  private visitActivityStmt(ctx: P.Activity_stmtContext): AST.ScopeChild | AST.ScopeChild[] | null {
    if (ctx.activity_labeled_stmt?.()) return this.visitLabeledActivity(ctx.activity_labeled_stmt()!);
    if (ctx.activity_data_field?.()) {
      const dd = ctx.activity_data_field()!.data_declaration();
      if (dd) return this.visitDataDecl(dd);
    }
    if (ctx.activity_bind_stmt?.()) {
      const bs = new AST.ActivityBindStmt();
      bs.location = this.loc(ctx);
      return bs;
    }
    if (ctx.action_handle_declaration?.()) return this.visitActionHandle(ctx.action_handle_declaration()!);
    if (ctx.activity_constraint_stmt?.()) {
      const ac = new AST.ActivityConstraint();
      ac.location = this.loc(ctx);
      return ac;
    }
    return null;
  }

  private visitLabeledActivity(ctx: any): AST.ScopeChild | null {
    // Unwrap: Activity_labeled_stmtContext -> Labeled_activity_stmtContext
    const inner = ctx.labeled_activity_stmt?.() ?? ctx;
    if (inner.activity_action_traversal_stmt?.()) return this.visitTraversal(inner.activity_action_traversal_stmt()!);
    if (inner.activity_sequence_block_stmt?.()) return this.visitSequenceBlock(inner.activity_sequence_block_stmt()!);
    if (inner.activity_parallel_stmt?.()) return this.visitParallel(inner.activity_parallel_stmt()!);
    if (inner.activity_schedule_stmt?.()) return this.visitSchedule(inner.activity_schedule_stmt()!);
    if (inner.activity_repeat_stmt?.()) return this.visitRepeat(inner.activity_repeat_stmt()!);
    if (inner.activity_foreach_stmt?.()) return this.visitActivityForeach(inner.activity_foreach_stmt()!);
    if (inner.activity_select_stmt?.()) return this.visitSelect(inner.activity_select_stmt()!);
    if (inner.activity_if_else_stmt?.()) return this.visitIfElse(inner.activity_if_else_stmt()!);
    if (inner.activity_match_stmt?.()) return this.visitActivityMatch(inner.activity_match_stmt()!);
    if (inner.activity_replicate_stmt?.()) return this.visitReplicate(inner.activity_replicate_stmt()!);
    if (inner.activity_super_stmt?.()) { const s = new AST.ActivitySuper(); s.location = this.loc(ctx); return s; }
    if (inner.activity_atomic_block_stmt?.()) return this.visitAtomicBlock(inner.activity_atomic_block_stmt()!);
    return null;
  }

  private visitTraversal(ctx: P.Activity_action_traversal_stmtContext): AST.ScopeChild {
    // action_type_traversal: do TypeName [with ...]
    const typeCtx = ctx.action_type_traversal_stmt?.();
    if (typeCtx) {
      const t = new AST.ActivityActionTypeTraversal();
      t.location = this.loc(ctx);
      const ti = typeCtx.type_identifier?.();
      if (ti) t.target = this.mkDTUserDefined(ti);
      return t;
    }
    // action_handle_traversal: handle.do [with ...]
    const t = new AST.ActivityActionHandleTraversal();
    t.location = this.loc(ctx);
    return t;
  }

  private visitSequenceBlock(ctx: P.Activity_sequence_block_stmtContext): AST.ActivitySequence {
    const seq = new AST.ActivitySequence();
    seq.location = this.loc(ctx);
    for (const ann of arr(ctx.activity_stmt_ann())) {
      const stmt = ann.activity_stmt?.();
      if (stmt) this.addChild(seq, this.visitActivityStmt(stmt));
    }
    return seq;
  }

  private visitParallel(ctx: P.Activity_parallel_stmtContext): AST.ActivityParallel {
    const p = new AST.ActivityParallel();
    p.location = this.loc(ctx);
    for (const branch of arr(ctx.activity_stmt_ann())) {
      const stmt = branch.activity_stmt?.();
      if (stmt) this.addChild(p, this.visitActivityStmt(stmt));
    }
    return p;
  }

  private visitSchedule(ctx: P.Activity_schedule_stmtContext): AST.ActivitySchedule {
    const s = new AST.ActivitySchedule();
    s.location = this.loc(ctx);
    for (const ann of arr(ctx.activity_stmt_ann())) {
      const stmt = ann.activity_stmt?.();
      if (stmt) this.addChild(s, this.visitActivityStmt(stmt));
    }
    return s;
  }

  private visitRepeat(ctx: P.Activity_repeat_stmtContext): AST.ScopeChild {
    if (ctx.TOK_WHILE?.()) {
      const rw = new AST.ActivityRepeatWhile();
      rw.location = this.loc(ctx);
      return rw;
    }
    const rc = new AST.ActivityRepeatCount();
    rc.location = this.loc(ctx);
    return rc;
  }

  private visitActivityForeach(ctx: P.Activity_foreach_stmtContext): AST.ActivityForeach {
    const fe = new AST.ActivityForeach();
    fe.location = this.loc(ctx);
    return fe;
  }

  private visitSelect(ctx: P.Activity_select_stmtContext): AST.ActivitySelect {
    const sel = new AST.ActivitySelect();
    sel.location = this.loc(ctx);
    return sel;
  }

  private visitIfElse(ctx: P.Activity_if_else_stmtContext): AST.ActivityIfElse {
    const ie = new AST.ActivityIfElse();
    ie.location = this.loc(ctx);
    return ie;
  }

  private visitActivityMatch(ctx: P.Activity_match_stmtContext): AST.ActivityMatch {
    const m = new AST.ActivityMatch();
    m.location = this.loc(ctx);
    return m;
  }

  private visitReplicate(ctx: P.Activity_replicate_stmtContext): AST.ActivityReplicate {
    const r = new AST.ActivityReplicate();
    r.location = this.loc(ctx);
    return r;
  }

  private visitAtomicBlock(ctx: P.Activity_atomic_block_stmtContext): AST.ActivityAtomicBlock {
    const ab = new AST.ActivityAtomicBlock();
    ab.location = this.loc(ctx);
    return ab;
  }

  // ── Exec ───────────────────────────────────────────────────────
  private visitExecBlockStmt(ctx: P.Exec_block_stmtContext): AST.ScopeChild | null {
    if (ctx.exec_block()) return this.visitExecBlock(ctx.exec_block()!);
    if (ctx.target_code_exec_block?.()) {
      const eb = new AST.ExecTargetTemplateBlock();
      eb.location = this.loc(ctx);
      return eb;
    }
    if (ctx.target_file_exec_block?.()) {
      const eb = new AST.ExecTargetTemplateBlock();
      eb.location = this.loc(ctx);
      return eb;
    }
    return null;
  }

  private visitExecBlock(ctx: P.Exec_blockContext): AST.ExecBlock {
    const eb = new AST.ExecBlock();
    eb.location = this.loc(ctx);
    const kindCtx = ctx.exec_kind();
    if (kindCtx) {
      const kindText = kindCtx.getText();
      const kindMap: Record<string, AST.enums.ExecKind> = {
        'body': AST.enums.ExecKind.ExecKind_Body,
        'header': AST.enums.ExecKind.ExecKind_Header,
        'declaration': AST.enums.ExecKind.ExecKind_Declaration,
        'run_start': AST.enums.ExecKind.ExecKind_RunStart,
        'run_end': AST.enums.ExecKind.ExecKind_RunEnd,
        'init_down': AST.enums.ExecKind.ExecKind_InitDown,
        'init_up': AST.enums.ExecKind.ExecKind_InitUp,
        'pre_solve': AST.enums.ExecKind.ExecKind_PreSolve,
        'post_solve': AST.enums.ExecKind.ExecKind_PostSolve,
      };
      eb.kind = kindMap[kindText] ?? AST.enums.ExecKind.ExecKind_Body;
    }
    for (const stmt of arr(ctx.exec_stmt())) this.addChild(eb, this.visitExecStmt(stmt));
    return eb;
  }

  private visitExecStmt(ctx: any): AST.ScopeChild | null {
    if (!ctx) return null;
    const ps = ctx.procedural_stmt?.();
    if (ps) return this.visitProceduralStmt(ps);
    return null;
  }

  private visitProceduralStmt(ctx: any): AST.ScopeChild | null {
    if (!ctx) return null;
    if (ctx.procedural_sequence_block_stmt?.()) {
      const body = new AST.ProceduralStmtBody();
      body.location = this.loc(ctx);
      return body;
    }
    if (ctx.procedural_if_else_stmt?.()) {
      const ie = new AST.ProceduralStmtIfElse();
      ie.location = this.loc(ctx);
      return ie;
    }
    if (ctx.procedural_repeat_stmt?.()) {
      const r = new AST.ProceduralStmtRepeat();
      r.location = this.loc(ctx);
      return r;
    }
    if (ctx.procedural_foreach_stmt?.()) {
      const fe = new AST.ProceduralStmtForeach();
      fe.location = this.loc(ctx);
      return fe;
    }
    if (ctx.procedural_return_stmt?.()) {
      const ret = new AST.ProceduralStmtReturn();
      ret.location = this.loc(ctx);
      return ret;
    }
    if (ctx.procedural_break_stmt?.()) {
      const b = new AST.ProceduralStmtBreak();
      b.location = this.loc(ctx);
      return b;
    }
    if (ctx.procedural_continue_stmt?.()) {
      const c = new AST.ProceduralStmtContinue();
      c.location = this.loc(ctx);
      return c;
    }
    if (ctx.procedural_match_stmt?.()) {
      const m = new AST.ProceduralStmtMatch();
      m.location = this.loc(ctx);
      return m;
    }
    if (ctx.procedural_yield_stmt?.()) {
      const y = new AST.ProceduralStmtYield();
      y.location = this.loc(ctx);
      return y;
    }
    // Expression/assignment/function call - generic exec statement
    const es = new AST.ExecStmt();
    es.location = this.loc(ctx);
    return es;
  }

  // ── Constraint ─────────────────────────────────────────────────
  private visitConstraintDecl(ctx: P.Constraint_declarationContext): AST.NamedScope {
    const ns = new AST.NamedScope();
    ns.location = this.loc(ctx);
    ns.docstring = this.doc(ctx);
    if (ctx.identifier?.()) ns.name = this.mkId(ctx.identifier()!);
    // Parse constraint body items
    const cblock = ctx.constraint_block?.();
    if (cblock) {
      for (const bi of arr(cblock.constraint_body_item())) {
        const sc = new AST.ScopeChild();
        sc.location = this.loc(bi);
        this.addChild(ns, sc);
      }
    }
    const cset = ctx.constraint_set?.();
    if (cset) {
      for (const bi of arr(cset.constraint_body_item())) {
        const sc = new AST.ScopeChild();
        sc.location = this.loc(bi);
        this.addChild(ns, sc);
      }
    }
    return ns;
  }

  private visitGenericConstraint(ctx: P.Generic_constraint_declarationContext): AST.ScopeChild {
    const sc = new AST.ScopeChild();
    sc.location = this.loc(ctx);
    return sc;
  }

  // ── Import / Extend / Typedef ──────────────────────────────────
  private visitImport(ctx: P.Import_stmtContext): AST.PackageImportStmt {
    const imp = new AST.PackageImportStmt();
    imp.location = this.loc(ctx);
    const pat = ctx.package_import_pattern();
    if (pat) {
      const ti = pat.type_identifier();
      if (ti) imp.path = this.visitTypeId(ti);
      const q = pat.package_import_qualifier();
      if (q) {
        if (q.package_import_wildcard()) imp.wildcard = true;
        else if (q.package_import_alias()) {
          const pid = q.package_import_alias()!.package_identifier?.();
          if (pid) imp.alias = this.mkId(pid);
        }
      }
    }
    return imp;
  }

  private visitExtend(ctx: P.Extend_stmtContext): AST.ScopeChild {
    // Check if it's extend enum
    if (ctx.TOK_ENUM?.()) {
      const ee = new AST.ExtendEnum();
      ee.location = this.loc(ctx);
      const ti = ctx.type_identifier();
      if (ti) ee.target = this.visitTypeId(ti);
      // Parse enum items in the extend body
      for (const itemCtx of arr(ctx.enum_item())) {
        const item = new AST.EnumItem();
        item.location = this.loc(itemCtx);
        if (itemCtx.identifier?.()) item.name = this.mkId(itemCtx.identifier()!);
        ee.items.push(item);
      }
      return ee;
    }
    // extend action/component/struct
    const ext = new AST.ExtendType();
    ext.location = this.loc(ctx);
    // Set extend kind from the grammar tokens
    if ((ctx as any)._is_action) ext.kind = AST.enums.ExtendTargetE.Action;
    else if ((ctx as any)._is_component) ext.kind = AST.enums.ExtendTargetE.Component;
    else if (ctx.struct_kind?.()) {
      const sk = ctx.struct_kind()!;
      if (sk.TOK_STRUCT?.()) ext.kind = AST.enums.ExtendTargetE.Struct;
      else if (sk.object_kind?.()) {
        const ok = sk.object_kind()!;
        if (ok.TOK_BUFFER?.()) ext.kind = AST.enums.ExtendTargetE.Buffer;
        else if (ok.TOK_RESOURCE?.()) ext.kind = AST.enums.ExtendTargetE.Resource;
        else if (ok.TOK_STATE?.()) ext.kind = AST.enums.ExtendTargetE.State;
        else if (ok.TOK_STREAM?.()) ext.kind = AST.enums.ExtendTargetE.Stream;
      }
    }
    const ti = ctx.type_identifier();
    if (ti) ext.target = this.visitTypeId(ti);
    // Parse body items for extend action/struct/component
    for (const bi of arr(ctx.action_body_item_ann?.())) {
      const item = bi.action_body_item?.();
      if (item) this.addChild(ext, this.visitActionBodyItem(item));
    }
    for (const bi of arr(ctx.struct_body_item?.())) {
      this.addChild(ext, this.visitStructBodyItem(bi));
    }
    for (const bi of arr(ctx.component_body_item_ann?.())) {
      const item = bi.component_body_item?.();
      if (item) this.addChild(ext, this.visitComponentBodyItem(item));
    }
    return ext;
  }

  private visitTypedef(ctx: P.Typedef_declarationContext): AST.TypedefDeclaration {
    const td = new AST.TypedefDeclaration();
    td.location = this.loc(ctx);
    td.docstring = this.doc(ctx);
    if (ctx.data_type?.()) td.type = this.visitDataType(ctx.data_type()!);
    else if (ctx.type_identifier()) td.type = this.mkDTUserDefined(ctx.type_identifier()!);
    const allTi = arr(ctx.type_identifier()); if (allTi.length > 0) td.name = this.mkId(allTi[allTi.length - 1]);
    return td;
  }

  // ── Annotation / Covergroup / Export / Function ─────────────────
  private visitAnnotation(ctx: P.Annotation_declarationContext): AST.AnnotationDecl {
    const ad = new AST.AnnotationDecl();
    ad.location = this.loc(ctx);
    ad.docstring = this.doc(ctx);
    if (ctx.annotation_identifier()) ad.name = this.mkId(ctx.annotation_identifier()!);
    return ad;
  }

  private visitCovergroup(ctx: P.Covergroup_declarationContext): AST.ScopeChild {
    const sc = new AST.ScopeChild();
    sc.location = this.loc(ctx);
    return sc;
  }

  private visitFuncDecl(ctx: P.Function_declContext): AST.FunctionDefinition {
    const fd = new AST.FunctionDefinition();
    fd.location = this.loc(ctx);
    fd.docstring = this.doc(ctx);
    const proto = ctx.function_prototype?.();
    if (proto) {
      const fp = new AST.FunctionPrototype();
      fp.location = this.loc(proto);
      if (proto.function_identifier?.()) fp.name = this.mkId(proto.function_identifier()!);
      fd.proto = fp;
    }
    return fd;
  }

  private visitProceduralFunction(ctx: any): AST.FunctionDefinition {
    const fd = new AST.FunctionDefinition();
    fd.location = this.loc(ctx);
    fd.docstring = this.doc(ctx);
    const proto = ctx.function_prototype?.();
    if (proto) {
      const fp = new AST.FunctionPrototype();
      fp.location = this.loc(proto);
      if (proto.function_identifier?.()) fp.name = this.mkId(proto.function_identifier()!);
      fd.proto = fp;
    }
    return fd;
  }

  private visitExportAction(ctx: P.Export_actionContext): AST.ScopeChild {
    const ea = new AST.ExportFunction();
    ea.location = this.loc(ctx);
    return ea;
  }

  // ── Python Import ──────────────────────────────────────────────
  private visitPyimport(ctx: P.Pyimport_stmtContext): AST.ScopeChild {
    const single = ctx.pyimport_single_module();
    if (single) {
      const stmt = new AST.PyImportStmt();
      stmt.location = this.loc(ctx);
      const mp = single.pyimport_mod_path();
      if (mp) for (const id of arr(mp.identifier())) stmt.path.push(this.mkId(id));
      if (single.identifier()) stmt.alias = this.mkId(single.identifier()!);
      return stmt;
    }
    const from = ctx.pyimport_from_module();
    if (from) {
      const stmt = new AST.PyImportFromStmt();
      stmt.location = this.loc(ctx);
      const mp = from.pyimport_mod_path();
      if (mp) for (const id of arr(mp.identifier())) stmt.path.push(this.mkId(id));
      const el = from.pyimport_elem_list();
      if (el) for (const id of arr(el.identifier())) stmt.targets.push(this.mkId(id));
      return stmt;
    }
    return new AST.PyImportStmt();
  }

  // ── Override / Pool / Bind / Symbol ────────────────────────────
  private visitOverride(ctx: any): AST.ScopeChild {
    const sc = new AST.ScopeChild();
    sc.location = this.loc(ctx);
    return sc;
  }

  private visitOverrideAction(ctx: any): AST.Action {
    const a = new AST.Action();
    a.location = this.loc(ctx);
    a.is_override = true;
    if (ctx.action_identifier?.()) a.name = this.mkId(ctx.action_identifier());
    for (const ann of arr(ctx.action_body_item_ann?.())) {
      const bi = ann.action_body_item?.();
      if (bi) this.addChild(a, this.visitActionBodyItem(bi));
    }
    return a;
  }

  private visitPoolDecl(ctx: any): AST.ScopeChild {
    const sc = new AST.ScopeChild();
    sc.location = this.loc(ctx);
    return sc;
  }

  private visitBindStmt(ctx: any): AST.ScopeChild {
    const sc = new AST.ScopeChild();
    sc.location = this.loc(ctx);
    return sc;
  }

  private visitSymbolDecl(ctx: any): AST.ScopeChild {
    const sc = new AST.ScopeChild();
    sc.location = this.loc(ctx);
    return sc;
  }

  // ── Template Params ────────────────────────────────────────────
  private mkTplParams(ctx: P.Template_param_decl_listContext): AST.TemplateParamDeclList {
    const list = new AST.TemplateParamDeclList();
    for (const pCtx of arr(ctx.template_param_decl())) {
      const tpd = pCtx.type_param_decl?.();
      const vpd = pCtx.value_param_decl?.();
      if (tpd) {
        const generic = tpd.generic_type_param_decl?.();
        const category = tpd.category_type_param_decl?.();
        if (generic) {
          const p = new AST.TemplateGenericTypeParamDecl();
          p.name = this.mkId(generic.identifier());
          if (generic.data_type?.()) p.dflt = this.visitDataType(generic.data_type()!) as AST.DataType | null;
          list.params.push(p);
        } else if (category) {
          const p = new AST.TemplateCategoryTypeParamDecl();
          p.name = this.mkId(category.identifier());
          p.category = this.mapTypeCategory(category.type_category());
          list.params.push(p);
        }
      } else if (vpd) {
        const p = new AST.TemplateValueParamDecl();
        p.name = this.mkId(vpd.identifier());
        if (vpd.data_type?.()) p.type = this.visitDataType(vpd.data_type()!) as AST.DataType | null;
        list.params.push(p);
      }
    }
    return list;
  }

  private mapTypeCategory(ctx: P.Type_categoryContext): AST.enums.TypeCategory {
    if (ctx.TOK_ACTION?.()) return AST.enums.TypeCategory.Action;
    if (ctx.TOK_COMPONENT?.()) return AST.enums.TypeCategory.Component;
    const sk = ctx.struct_kind?.();
    if (sk) {
      if (sk.TOK_STRUCT?.()) return AST.enums.TypeCategory.Struct;
      const ok = sk.object_kind?.();
      if (ok?.TOK_BUFFER?.()) return AST.enums.TypeCategory.Buffer;
      if (ok?.TOK_STREAM?.()) return AST.enums.TypeCategory.Stream;
      if (ok?.TOK_STATE?.()) return AST.enums.TypeCategory.State;
      if (ok?.TOK_RESOURCE?.()) return AST.enums.TypeCategory.Resource;
    }
    return AST.enums.TypeCategory.Struct;
  }

  // ── Helpers ────────────────────────────────────────────────────
  private mkId(ctx: ParserRuleContext): AST.ExprId {
    const id = new AST.ExprId();
    id.id = ctx.getText();
    id.location = this.loc(ctx);
    return id;
  }

  private addChild(parent: { children: AST.ScopeChild[] }, child: AST.ScopeChild | AST.ScopeChild[] | null): void {
    if (!child) return;
    if (Array.isArray(child)) {
      for (const c of child) {
        c.parent = parent as any;
        parent.children.push(c);
      }
    } else {
      child.parent = parent as any;
      parent.children.push(child);
    }
  }

  private loc(ctx: ParserRuleContext): Location {
    const s = ctx.start;
    const e = ctx.stop;
    if (!s) return mkLocation();
    return { fileid: this.fileId, lineno: s.line, linepos: s.column,
             extent: e ? (e.stop - s.start + 1) : (s.text?.length ?? 1) };
  }

  private doc(ctx: ParserRuleContext): string {
    const s = ctx.start;
    if (!s) return '';
    return this.harvester.harvest(s.tokenIndex) ?? '';
  }
}

// Utility: ensure we always get an array from ANTLR context list accessors
function arr<T>(val: T[] | T | null | undefined): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}
