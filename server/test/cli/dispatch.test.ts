import { describe, it, expect } from 'vitest';
import { dispatch, USAGE } from '../../src/cli/dispatch.js';

/**
 * `pss-ls` argument handling, without spawning a process. The installed bin
 * itself is exercised by the package tests.
 */
describe('pss-ls dispatch', () => {
  it.each([['--version'], ['-v']])('%s prints the version', flag => {
    expect(dispatch([flag])).toEqual({ kind: 'version' });
  });

  it.each([['--help'], ['-h']])('%s prints help', flag => {
    expect(dispatch([flag])).toEqual({ kind: 'help' });
  });

  it('honours --version and --help after a transport flag', () => {
    expect(dispatch(['--stdio', '--version'])).toEqual({ kind: 'version' });
    expect(dispatch(['--stdio', '--help'])).toEqual({ kind: 'help' });
  });

  it('lets the first of --version and --help decide', () => {
    expect(dispatch(['--help', '--version'])).toEqual({ kind: 'help' });
    expect(dispatch(['-v', '-h'])).toEqual({ kind: 'version' });
  });

  it('starts the server with no arguments', () => {
    expect(dispatch([])).toEqual({ kind: 'serve' });
  });

  it.each([
    [['--stdio']],
    [['--node-ipc']],
    [['--socket=5007']],
    [['--socket', '5007']],
    [['--pipe=/tmp/pss.sock']],
    [['--clientProcessId=1234']],
    [['--stdio', '--clientProcessId=1234']],
  ])('starts the server for %j', args => {
    expect(dispatch(args)).toEqual({ kind: 'serve' });
  });

  it('rejects a leading positional argument rather than waiting on stdin', () => {
    const command = dispatch(['src/']);
    expect(command.kind).toBe('usage-error');
    expect(command.kind === 'usage-error' && command.message).toContain("'src/'");
  });

  it('points command-line checking at pssparser', () => {
    expect(USAGE).toContain('pip install pssparser');
  });
});
