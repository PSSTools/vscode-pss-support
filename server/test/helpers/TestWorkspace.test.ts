import { describe, it, expect } from 'vitest';
import { TestWorkspace } from '../helpers/TestWorkspace';

describe('TestWorkspace', () => {
  it('parseOne returns non-null AST for trivial PSS', () => {
    const ws = new TestWorkspace();
    const result = ws.parseOne('struct s { }');
    expect(result.tree).toBeDefined();
    expect(result.errors).toHaveLength(0);
  });

  it('cursorPosition finds pipe marker', () => {
    const ws = new TestWorkspace();
    const { cleanSource, position } = ws.cursorPosition('struct |s { }');
    expect(cleanSource).toBe('struct s { }');
    expect(position.line).toBe(0);
    expect(position.character).toBe(7);
  });

  it('markerPosition finds named marker', () => {
    const ws = new TestWorkspace();
    const source = 'struct /*here*/s { }';
    const pos = ws.markerPosition(source, 'here');
    expect(pos.line).toBe(0);
    expect(pos.character).toBe(7);
  });

  it('parseFile parses added files', () => {
    const ws = new TestWorkspace();
    ws.addFile('test.pss', 'struct s { }');
    const result = ws.parseFile('test.pss');
    expect(result.errors).toHaveLength(0);
  });
});
