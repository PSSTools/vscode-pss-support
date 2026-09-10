import { describe, it, expect } from 'vitest';
import { DocumentSession } from '../../../src/core/index/DocumentSession.js';
import { WorkspaceIndex } from '../../../src/core/index/WorkspaceIndex.js';
import { Diagnostic } from '../../../src/core/types/Diagnostic.js';
import { FakeTimer } from '../../helpers/FakeTimer.js';

const URI = 'file:///ws/top.pss';

function setup(debounceMs = 300) {
  const index = new WorkspaceIndex();
  const timer = new FakeTimer();
  const published: Array<{ uri: string; diagnostics: Diagnostic[] }> = [];
  const session = new DocumentSession(index, {
    debounceMs,
    timer,
    onDiagnostics: (uri, diagnostics) => published.push({ uri, diagnostics }),
  });
  return { index, timer, session, published };
}

describe('DocumentSession', () => {
  it('does not parse before the debounce elapses', () => {
    const { index, timer, session } = setup();
    session.didChangeContent(URI, 'component c { }');

    timer.advance(299);
    expect(index.getAST(URI)).toBeUndefined();

    timer.advance(1);
    expect(index.getAST(URI)).toBeDefined();
  });

  it('coalesces rapid edits into a single parse', () => {
    const { index, timer, session, published } = setup();

    session.didChangeContent(URI, 'component a { }');
    timer.advance(100);
    session.didChangeContent(URI, 'component b { }');
    timer.advance(100);
    session.didChangeContent(URI, 'component c { }');
    timer.advance(300);

    // One publish for the file itself, from one parse of the final text.
    expect(published.filter(p => p.uri === URI)).toHaveLength(1);
    expect(index.getText(URI)).toBe('component c { }');
    expect(timer.pendingCount()).toBe(0);
  });

  it('ensureParsed flushes a pending edit rather than answering from a stale AST', () => {
    const { index, session } = setup();

    session.didChangeContent(URI, 'component first { }');
    session.ensureParsed(URI);
    expect(index.getText(URI)).toBe('component first { }');

    // The exact bug this guards: query immediately after an edit.
    session.didChangeContent(URI, 'component second { }');
    session.ensureParsed(URI);
    expect(index.getText(URI)).toBe('component second { }');
  });

  it('ensureParsed is a no-op when nothing is pending', () => {
    const { index, timer, session } = setup();
    session.didChangeContent(URI, 'component c { }');
    timer.advance(300);

    session.ensureParsed(URI);
    expect(index.getText(URI)).toBe('component c { }');
    expect(session.hasPendingEdits(URI)).toBe(false);
  });

  it('cancels the pending timer when flushed, so no double parse occurs', () => {
    const { timer, session, published } = setup();
    session.didChangeContent(URI, 'component c { }');
    session.ensureParsed(URI);
    timer.advance(1000);

    expect(published.filter(p => p.uri === URI)).toHaveLength(1);
  });

  it('publishes diagnostics after parsing', () => {
    const { timer, session, published } = setup();
    session.didChangeContent(URI, 'component top { unknown_t x; }');
    timer.advance(300);

    const entry = published.find(p => p.uri === URI);
    expect(entry).toBeDefined();
    expect(entry!.diagnostics.some(d => d.code === 'undefined-type')).toBe(true);
  });

  it('clears diagnostics and drops the file on close', () => {
    const { index, timer, session, published } = setup();
    session.didChangeContent(URI, 'component c { }');
    timer.advance(300);

    session.didClose(URI);

    expect(index.getAST(URI)).toBeUndefined();
    expect(published.at(-1)).toEqual({ uri: URI, diagnostics: [] });
  });

  it('cancels pending work on close', () => {
    const { index, timer, session } = setup();
    session.didChangeContent(URI, 'component c { }');
    session.didClose(URI);
    timer.advance(1000);

    expect(index.getAST(URI)).toBeUndefined();
  });

  it('republishes dependents when a dependency changes', () => {
    const { timer, session, published } = setup();
    const pkgUri = 'file:///ws/pkg.pss';
    const topUri = 'file:///ws/top.pss';

    session.didChangeContent(pkgUri, 'package p { struct s { } }');
    timer.advance(300);
    session.didChangeContent(topUri, 'component top { p::s x; }');
    timer.advance(300);

    published.length = 0;

    // Removing the struct must re-diagnose top.pss, not just pkg.pss.
    session.didChangeContent(pkgUri, 'package p { }');
    timer.advance(300);

    expect(published.map(p => p.uri)).toContain(topUri);
  });

  it('indexes on-disk changes for files that are not open', () => {
    const { index, session } = setup();
    const uri = 'file:///ws/other.pss';

    session.didChangeOnDisk(uri, 'component from_disk { }');
    expect(index.getText(uri)).toBe('component from_disk { }');
  });

  it('lets an open buffer win over a stale on-disk copy', () => {
    const { index, timer, session } = setup();
    session.didChangeContent(URI, 'component from_buffer { }');
    timer.advance(300);

    session.didChangeOnDisk(URI, 'component from_disk { }');

    expect(index.getText(URI)).toBe('component from_buffer { }');
  });

  it('removes deleted files and clears their diagnostics', () => {
    const { index, session, published } = setup();
    const uri = 'file:///ws/other.pss';
    session.didChangeOnDisk(uri, 'component c { unknown_t x; }');

    session.didDeleteOnDisk(uri);

    expect(index.getAST(uri)).toBeUndefined();
    expect(published.at(-1)).toEqual({ uri, diagnostics: [] });
  });

  it('flushAll drains every pending document', () => {
    const { index, session } = setup();
    session.didChangeContent('file:///a.pss', 'component a { }');
    session.didChangeContent('file:///b.pss', 'component b { }');

    session.flushAll();

    expect(index.getAST('file:///a.pss')).toBeDefined();
    expect(index.getAST('file:///b.pss')).toBeDefined();
  });
});
