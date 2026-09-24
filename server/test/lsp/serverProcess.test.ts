import { describe, it, expect } from 'vitest';
import { hasTransportFlag, withDefaultTransport } from '../../src/lsp/serverProcess.js';

/**
 * Transport selection. `createConnection` throws when argv names no
 * transport, so the server supplies `--stdio`, and must leave every explicit
 * choice alone -- in particular `--node-ipc`, which is how VS Code forks it.
 */
describe('transport selection', () => {
  it('defaults to stdio when no transport is named', () => {
    expect(withDefaultTransport([])).toEqual(['--stdio']);
    expect(withDefaultTransport(['--clientProcessId=42'])).toEqual(['--clientProcessId=42', '--stdio']);
  });

  it.each([
    [['--stdio']],
    [['--node-ipc']],
    [['--node-ipc', '--clientProcessId=42']],
    [['--socket=5007']],
    [['--socket', '5007']],
    [['--pipe=/tmp/pss.sock']],
    [['--pipe', '/tmp/pss.sock']],
  ])('leaves %j alone', args => {
    expect(hasTransportFlag(args)).toBe(true);
    expect(withDefaultTransport(args)).toEqual(args);
  });

  it('does not mistake a look-alike for a transport flag', () => {
    expect(hasTransportFlag(['--stdio-x', '--sockets=1'])).toBe(false);
  });
});
