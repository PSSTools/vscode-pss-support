import { describe, it, expect } from 'vitest';
import { loadPSSConfig, PSSConfigAdapter } from '../../../src/core/config/PSSConfigLoader.js';
import { MemFileSystem } from '../../../src/core/io/MemFileSystem.js';

describe('loadPSSConfig', () => {
  it('reads .pssconfig.json from the workspace root', () => {
    const fs = new MemFileSystem({
      '/ws/.pssconfig.json': JSON.stringify({ format: { indentSize: 2 } }),
    });
    expect(loadPSSConfig('/ws', fs).format?.indentSize).toBe(2);
  });

  it('returns an empty config when the file is absent', () => {
    expect(loadPSSConfig('/ws', new MemFileSystem())).toEqual({});
  });

  it('returns an empty config rather than throwing on malformed JSON', () => {
    const fs = new MemFileSystem({ '/ws/.pssconfig.json': '{ not json' });
    expect(loadPSSConfig('/ws', fs)).toEqual({});
  });

  it('tolerates a trailing separator on the root path', () => {
    const fs = new MemFileSystem({
      '/ws/.pssconfig.json': JSON.stringify({ standardVersion: '3.1' }),
    });
    expect(loadPSSConfig('/ws/', fs).standardVersion).toBe('3.1');
  });
});

describe('PSSConfigAdapter', () => {
  const adapter = new PSSConfigAdapter({
    format: { indentSize: 2, insertFinalNewline: false },
    lint: { enabled: true, rules: { 'naming-convention': false } },
  });

  it('resolves dotted keys', () => {
    expect(adapter.get('format.indentSize', 4)).toBe(2);
  });

  it('strips a leading pss. segment', () => {
    expect(adapter.get('pss.format.indentSize', 4)).toBe(2);
  });

  it('returns the default for an unset key', () => {
    expect(adapter.get('format.nonexistent', 'fallback')).toBe('fallback');
  });

  it('returns the default when an intermediate segment is missing', () => {
    expect(adapter.get('missing.deeply.nested', 7)).toBe(7);
  });

  it('preserves falsy configured values instead of falling back', () => {
    expect(adapter.get('format.insertFinalNewline', true)).toBe(false);
    expect(adapter.get('lint.rules.naming-convention', true)).toBe(false);
  });
});
