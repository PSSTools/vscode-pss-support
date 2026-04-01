import { describe, it, expect } from 'vitest';
import {
  Action,
  Component,
  Struct,
  GlobalScope,
  Scope,
  ScopeChild,
  Field,
  ExprId,
  enums,
  flags,
} from '../../../src/core/ast/generated';
import { ASTFactory } from '../../../src/core/ast/generated/factory';

describe('Generated AST', () => {
  it('Action class can be instantiated', () => {
    const a = new Action();
    expect(a).toBeInstanceOf(Action);
    expect(a.is_abstract).toBe(false);
  });

  it('Action extends Scope hierarchy', () => {
    const a = new Action();
    expect(a).toBeInstanceOf(Scope);
    expect(a).toBeInstanceOf(ScopeChild);
  });

  it('Field has correct default attributes', () => {
    const f = new Field();
    expect(f.attr).toBe(flags.FieldAttr.None);
    expect(f.type).toBeNull();
    expect(f.init).toBeNull();
  });

  it('ExprBinOp enum has values', () => {
    expect(enums.ExprBinOp.BinOp_Add).toBeDefined();
    expect(typeof enums.ExprBinOp.BinOp_Add).toBe('number');
  });

  it('FieldAttr flags has values', () => {
    expect(flags.FieldAttr.Rand).toBe(4);
    expect(flags.FieldAttr.Const).toBe(8);
    expect(flags.FieldAttr.None).toBe(0);
  });

  it('GlobalScope can be created', () => {
    const gs = new GlobalScope();
    gs.fileid = 0;
    expect(gs.fileid).toBe(0);
    expect(gs.children).toEqual([]);
  });

  it('ASTFactory creates instances', () => {
    const factory = new ASTFactory();
    const comp = factory.mkComponent();
    expect(comp).toBeInstanceOf(Component);
    const action = factory.mkAction();
    expect(action).toBeInstanceOf(Action);
  });

  it('accept calls the visitor', () => {
    const a = new Action();
    const result = a.accept({
      visitAction: (node) => 'visited-action',
    });
    expect(result).toBe('visited-action');
  });

  it('accept returns null for missing visitor method', () => {
    const a = new Action();
    const result = a.accept({});
    expect(result).toBeNull();
  });
});
