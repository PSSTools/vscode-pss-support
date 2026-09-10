import { describe, it, expect } from 'vitest';
import { parseMarkers, offsetToPosition, positionToOffset } from './Markers.js';

describe('parseMarkers', () => {
  it('strips markers from the source', () => {
    const { text } = parseMarkers('struct /*[def:s]*/s { }');
    expect(text).toBe('struct s { }');
  });

  it('records the position immediately after the marker', () => {
    const { markers } = parseMarkers('struct /*[def:s]*/s { }');
    expect(markers).toHaveLength(1);
    expect(markers[0].position).toEqual({ line: 0, character: 7 });
  });

  it('splits kind and name', () => {
    const { markers } = parseMarkers('/*[ref:my_type]*/x');
    expect(markers[0].kind).toBe('ref');
    expect(markers[0].name).toBe('my_type');
    expect(markers[0].label).toBe('ref:my_type');
  });

  it('treats a colon-less label as a bare name', () => {
    const { markers } = parseMarkers('/*[here]*/x');
    expect(markers[0].kind).toBe('');
    expect(markers[0].name).toBe('here');
  });

  it('handles multiple markers across lines', () => {
    const source = [
      'package p {',
      '  struct /*[def:s]*/s { }',
      '}',
      'component c { p::/*[ref:s]*/s x; }',
    ].join('\n');
    const { text, markers } = parseMarkers(source);

    expect(text).toBe([
      'package p {',
      '  struct s { }',
      '}',
      'component c { p::s x; }',
    ].join('\n'));
    expect(markers.map(m => m.label)).toEqual(['def:s', 'ref:s']);
    expect(markers[0].position).toEqual({ line: 1, character: 9 });
    expect(markers[1].position).toEqual({ line: 3, character: 17 });
  });

  it('supports a bare pipe cursor', () => {
    const { text, markers } = parseMarkers('struct |s { }');
    expect(text).toBe('struct s { }');
    expect(markers[0].name).toBe('cursor');
    expect(markers[0].position).toEqual({ line: 0, character: 7 });
  });

  it('leaves unmarked sources untouched', () => {
    const { text, markers } = parseMarkers('struct s { }');
    expect(text).toBe('struct s { }');
    expect(markers).toEqual([]);
  });
});

describe('offset/position conversion', () => {
  const text = 'line one\nline two\nline three';

  it('round-trips every offset', () => {
    for (let i = 0; i <= text.length; i++) {
      expect(positionToOffset(text, offsetToPosition(text, i))).toBe(i);
    }
  });

  it('computes positions on later lines', () => {
    expect(offsetToPosition(text, 9)).toEqual({ line: 1, character: 0 });
    expect(offsetToPosition(text, 14)).toEqual({ line: 1, character: 5 });
  });
});
