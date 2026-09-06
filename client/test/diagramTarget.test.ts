import { describe, it, expect } from 'vitest';
import { resolveDiagramTarget } from '../src/diagramTarget';

const pssEditor = { uri: 'file:///ws/a.pss', languageId: 'pss', activeLine: 7 };

describe('resolveDiagramTarget', () => {
  it('prefers explicit arguments, as passed by a code lens', () => {
    const target = resolveDiagramTarget('file:///ws/b.pss', 3, pssEditor);
    expect(target).toEqual({ ok: true, uri: 'file:///ws/b.pss', line: 3 });
  });

  it('defaults the line to 0 when only a uri is given', () => {
    expect(resolveDiagramTarget('file:///ws/b.pss', undefined, undefined))
      .toEqual({ ok: true, uri: 'file:///ws/b.pss', line: 0 });
  });

  it('falls back to the active editor and its cursor line', () => {
    expect(resolveDiagramTarget(undefined, undefined, pssEditor))
      .toEqual({ ok: true, uri: 'file:///ws/a.pss', line: 7 });
  });

  it('refuses when there is no active editor', () => {
    expect(resolveDiagramTarget(undefined, undefined, undefined))
      .toEqual({ ok: false, reason: 'no-pss-editor' });
  });

  it('refuses when the active editor is not a PSS file', () => {
    expect(resolveDiagramTarget(undefined, undefined, { ...pssEditor, languageId: 'plaintext' }))
      .toEqual({ ok: false, reason: 'no-pss-editor' });
  });

  it('honours an explicit uri even with a non-PSS editor focused', () => {
    const target = resolveDiagramTarget('file:///ws/b.pss', 1, { ...pssEditor, languageId: 'json' });
    expect(target).toEqual({ ok: true, uri: 'file:///ws/b.pss', line: 1 });
  });

  it('treats line 0 as a real line, not a missing one', () => {
    expect(resolveDiagramTarget('file:///ws/b.pss', 0, undefined))
      .toEqual({ ok: true, uri: 'file:///ws/b.pss', line: 0 });
  });
});
