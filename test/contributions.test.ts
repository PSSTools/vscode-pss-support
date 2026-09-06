import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Consistency checks on the extension's declared contributions.
 *
 * Nothing else validates these files: package.json, the snippets, and the
 * language configuration are data, and a typo in any of them produces a feature
 * that silently does nothing in the installed extension.
 */

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf-8');

/**
 * VS Code accepts JSONC for its configuration files, and
 * language-configuration.json uses comments. Strip them (outside string
 * literals) before parsing.
 */
const readJson = (rel: string) => {
  const stripped = read(rel).replace(
    /"(?:[^"\\]|\\.)*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    match => (match.startsWith('"') ? match : ''),
  );
  return JSON.parse(stripped);
};

const pkg = readJson('package.json');

describe('package.json contributions', () => {
  it('declares the pss language with the .pss extension', () => {
    const lang = pkg.contributes.languages.find((l: { id: string }) => l.id === 'pss');
    expect(lang).toBeDefined();
    expect(lang.extensions).toContain('.pss');
    expect(existsSync(join(ROOT, lang.configuration))).toBe(true);
  });

  it('points at files that exist', () => {
    for (const grammar of pkg.contributes.grammars) {
      expect(existsSync(join(ROOT, grammar.path)), grammar.path).toBe(true);
    }
    for (const snippet of pkg.contributes.snippets) {
      expect(existsSync(join(ROOT, snippet.path)), snippet.path).toBe(true);
    }
    expect(existsSync(join(ROOT, pkg.icon)), pkg.icon).toBe(true);
  });

  it('declares a main entry point that the build produces', () => {
    // `main` is extension-relative and omits the .js suffix.
    expect(pkg.main).toBe('./client/out/extension');
    expect(existsSync(join(ROOT, 'client/src/extension.ts'))).toBe(true);
  });

  it('registers every contributed command in the client', () => {
    const extensionSource = read('client/src/extension.ts');
    for (const command of pkg.contributes.commands) {
      expect(
        extensionSource.includes(`'${command.command}'`),
        `command '${command.command}' is contributed but never registered`,
      ).toBe(true);
    }
  });

  it('contributes every command referenced by a menu', () => {
    const declared = new Set(pkg.contributes.commands.map((c: { command: string }) => c.command));
    for (const [menu, entries] of Object.entries(pkg.contributes.menus ?? {})) {
      for (const entry of entries as Array<{ command: string }>) {
        expect(declared.has(entry.command), `menu '${menu}' references '${entry.command}'`).toBe(true);
      }
    }
  });
});

describe('configuration schema', () => {
  const properties: Record<string, { type: string; default: unknown }> =
    pkg.contributes.configuration.properties;

  it('gives every setting a type and a default', () => {
    for (const [key, schema] of Object.entries(properties)) {
      expect(schema.type, `${key} has no type`).toBeDefined();
      expect(schema.default, `${key} has no default`).toBeDefined();
    }
  });

  it('namespaces every setting under pss.', () => {
    for (const key of Object.keys(properties)) {
      expect(key.startsWith('pss.'), `${key} is not namespaced`).toBe(true);
    }
  });

  /**
   * Every declared setting should be read somewhere. `pss.trace.server` is the
   * exception: it is consumed by vscode-languageclient itself, not by our code.
   */
  it('reads every setting it declares', () => {
    const CLIENT_LIBRARY_OWNED = new Set(['pss.trace.server']);
    const sources = [
      read('server/src/lsp/PSSLanguageServer.ts'),
      read('server/src/core/services/LintService.ts'),
      read('server/src/core/services/FormatterService.ts'),
      read('server/src/core/services/CompletionService.ts'),
      read('server/src/core/config/PSSConfigLoader.ts'),
    ].join('\n');

    // Look for the key as a string literal -- a `config.get('...')` call --
    // rather than anywhere in the text, so prose in a comment does not count
    // as reading the setting.
    const unread: string[] = [];
    for (const key of Object.keys(properties)) {
      if (CLIENT_LIBRARY_OWNED.has(key)) continue;
      const bare = key.replace(/^pss\./, '');
      const referenced = [key, bare].some(name =>
        sources.includes(`'${name}'`) || sources.includes(`"${name}"`));
      if (!referenced) unread.push(key);
    }

    // `pss.maxNumberOfProblems` is declared but not yet consumed; wiring it is
    // part of the diagnostics work (marker cap PSS029). Listed explicitly so
    // the gap is visible rather than silently tolerated.
    expect(unread).toEqual(['pss.maxNumberOfProblems']);
  });
});

describe('snippets', () => {
  const snippets: Record<string, {
    prefix: string | string[];
    body: string | string[];
    description?: string;
  }> = readJson('snippets/pss.json');

  it('is a non-empty object', () => {
    expect(Object.keys(snippets).length).toBeGreaterThan(0);
  });

  it('gives every snippet a prefix and a body', () => {
    for (const [name, snippet] of Object.entries(snippets)) {
      expect(snippet.prefix, `${name} has no prefix`).toBeTruthy();
      expect(snippet.body, `${name} has no body`).toBeTruthy();
      expect(
        Array.isArray(snippet.body) ? snippet.body.length : snippet.body.length,
        `${name} has an empty body`,
      ).toBeGreaterThan(0);
    }
  });

  it('uses no duplicate prefixes', () => {
    const seen = new Map<string, string>();
    for (const [name, snippet] of Object.entries(snippets)) {
      for (const prefix of ([] as string[]).concat(snippet.prefix)) {
        const previous = seen.get(prefix);
        expect(previous, `prefix '${prefix}' is used by both ${previous} and ${name}`)
          .toBeUndefined();
        seen.set(prefix, name);
      }
    }
  });

  it('uses well-formed tabstop placeholders', () => {
    for (const [name, snippet] of Object.entries(snippets)) {
      const body = ([] as string[]).concat(snippet.body).join('\n');
      for (const placeholder of body.match(/\$\{[^}]*\}/g) ?? []) {
        expect(placeholder, `${name} has a malformed placeholder ${placeholder}`)
          .toMatch(/^\$\{\d+(:[^}]*)?\}$/);
      }
    }
  });

  it('balances braces in every body', () => {
    for (const [name, snippet] of Object.entries(snippets)) {
      const body = ([] as string[]).concat(snippet.body).join('\n');
      // Strip placeholders first; their braces are snippet syntax, not code.
      const code = body.replace(/\$\{[^}]*\}/g, 'X');
      const opens = (code.match(/\{/g) ?? []).length;
      const closes = (code.match(/\}/g) ?? []).length;
      expect(opens, `${name} has unbalanced braces`).toBe(closes);
    }
  });
});

describe('language configuration', () => {
  const config = readJson('language-configuration.json');

  it('defines line and block comments', () => {
    expect(config.comments.lineComment).toBe('//');
    expect(config.comments.blockComment).toEqual(['/*', '*/']);
  });

  it('defines matching brackets', () => {
    expect(config.brackets).toEqual(
      expect.arrayContaining([['{', '}'], ['[', ']'], ['(', ')']]),
    );
  });

  it('auto-closes every bracket pair it declares as a bracket', () => {
    const autoClosing = new Set(
      (config.autoClosingPairs ?? []).map((p: string[] | { open: string }) =>
        Array.isArray(p) ? p[0] : p.open),
    );
    for (const [open] of config.brackets) {
      expect(autoClosing.has(open), `bracket '${open}' has no auto-closing pair`).toBe(true);
    }
  });
});

describe('packaging', () => {
  const vscodeignore = read('.vscodeignore').split('\n').map(l => l.trim()).filter(Boolean);

  it('excludes TypeScript sources and grammars from the package', () => {
    expect(vscodeignore).toContain('**/*.ts');
    expect(vscodeignore).toContain('*.g4');
  });

  it('excludes .env files', () => {
    expect(vscodeignore).toContain('**/.env');
  });

  it('does not exclude the compiled server the client spawns', () => {
    // client/src/extension.ts resolves 'server/out/server.js'.
    for (const pattern of vscodeignore) {
      expect(pattern.startsWith('server/out'), `'${pattern}' would exclude the server`).toBe(false);
    }
  });

  /**
   * Known gap: the stdlib .pss sources are not copied into the package, so an
   * installed user always falls back to the 4-line BUNDLED_STDLIB stub. This
   * test documents the state and fails once the build starts shipping them,
   * at which point it should become a positive assertion.
   */
  it('does not yet package the stdlib sources', () => {
    expect(existsSync(join(ROOT, 'server/out/stdlib'))).toBe(false);
  });
});
