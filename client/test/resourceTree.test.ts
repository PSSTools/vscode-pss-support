import { describe, it, expect } from 'vitest';
import { bindingsToTree, ResourceBinding } from '../src/views/resourceTree';

const binding = (over: Partial<ResourceBinding> = {}): ResourceBinding => ({
  actionName: 'write_a',
  resourceName: 'chan',
  resourceType: 'chan_r',
  kind: 'lock',
  uri: 'file:///ws/a.pss',
  line: 3,
  ...over,
});

describe('bindingsToTree', () => {
  it('returns nothing for no bindings', () => {
    expect(bindingsToTree([])).toEqual([]);
  });

  it('groups bindings under their action', () => {
    const tree = bindingsToTree([
      binding({ actionName: 'a1', resourceName: 'r1' }),
      binding({ actionName: 'a1', resourceName: 'r2' }),
      binding({ actionName: 'a2', resourceName: 'r3' }),
    ]);

    expect(tree.map(n => n.label)).toEqual(['a1', 'a2']);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[1].children).toHaveLength(1);
  });

  it('labels a leaf with kind, type and name', () => {
    const tree = bindingsToTree([
      binding({ kind: 'lock', resourceType: 'chan_r', resourceName: 'chan' }),
    ]);
    expect(tree[0].children![0].label).toBe('lock chan_r chan');
  });

  it('carries the source location onto leaves so they can navigate', () => {
    const tree = bindingsToTree([binding({ uri: 'file:///ws/x.pss', line: 12 })]);
    const leaf = tree[0].children![0];

    expect(leaf.uri).toBe('file:///ws/x.pss');
    expect(leaf.line).toBe(12);
  });

  it('marks action groups collapsible and leaves not', () => {
    const tree = bindingsToTree([binding()]);
    expect(tree[0].collapsible).toBe(true);
    expect(tree[0].children![0].collapsible).toBe(false);
  });

  it('uses the binding kind as the leaf kind, for contextValue', () => {
    const tree = bindingsToTree([
      binding({ kind: 'lock' }),
      binding({ kind: 'share' }),
      binding({ kind: 'input' }),
      binding({ kind: 'output' }),
    ]);
    expect(tree[0].children!.map(c => c.kind)).toEqual(['lock', 'share', 'input', 'output']);
  });

  it('preserves first-seen order so the view does not reshuffle', () => {
    const tree = bindingsToTree([
      binding({ actionName: 'zeta' }),
      binding({ actionName: 'alpha' }),
      binding({ actionName: 'zeta', resourceName: 'other' }),
    ]);
    expect(tree.map(n => n.label)).toEqual(['zeta', 'alpha']);
    expect(tree[0].children!.map(c => c.label)).toEqual([
      'lock chan_r chan',
      'lock chan_r other',
    ]);
  });
});
