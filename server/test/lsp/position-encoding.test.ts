import { describe, it, expect, afterEach } from 'vitest';
import { startTestServer, initialize, openDoc, waitForDiagnostics, TestServer } from './harness.js';

/**
 * Position encoding (plan 1.7). The server speaks UTF-16, the LSP default,
 * and must not claim otherwise even to a client that offers UTF-8 or UTF-32.
 *
 * A syntax error is used because its column comes straight from a token; the
 * linker's markers carry a separate off-by-one (see disk-workspace.test.ts).
 * In each line the `}` that should have been preceded by `;` is the error.
 */

const URI = 'file:///ws/enc.pss';

let server: TestServer | undefined;

afterEach(() => {
  server?.dispose();
  server = undefined;
});

async function errorColumn(line: string): Promise<{ actual: number; utf16: number }> {
  server = startTestServer();
  await initialize(server);
  await openDoc(server, URI, `component c {\n${line}`);
  const published = await waitForDiagnostics(server, URI);
  server.dispose();
  server = undefined;
  return { actual: published.diagnostics[0].range.start.character, utf16: line.indexOf('}') };
}

describe('position encoding', () => {
  it('does not negotiate away from UTF-16', async () => {
    server = startTestServer();
    const result = await initialize(server, {
      capabilities: { general: { positionEncodings: ['utf-8', 'utf-32', 'utf-16'] } },
    });
    expect(result.capabilities.positionEncoding).toBeUndefined();
  });

  it('counts ASCII columns in UTF-16 units', async () => {
    const { actual, utf16 } = await errorColumn('  /* ab */ int a }');
    expect(actual).toBe(utf16);
  });

  it('counts a BMP character before the error as one unit', async () => {
    // `é` is two bytes in UTF-8 and one unit in UTF-16.
    const { actual, utf16 } = await errorColumn('  /* éé */ int a }');
    expect(actual).toBe(utf16);
  });

  it('recorded gap: counts an astral character as one unit, not two', async () => {
    // `😀` is one code point and two UTF-16 units. The parser reports columns
    // in code points, and `lspChar` passes them through, so every column after
    // an astral character is one short per character. Pinned here so a fix
    // shows up as this test failing; see plan 1.7.
    const { actual, utf16 } = await errorColumn('  /* 😀 */ int a }');
    expect(actual).toBe(utf16 - 1);
  });
});
