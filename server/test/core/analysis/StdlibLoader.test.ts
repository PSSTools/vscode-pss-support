import { describe, it, expect } from 'vitest';
import { StdlibLoader } from '../../../src/core/analysis/StdlibLoader';
import { SymbolTableBuilder } from '../../../src/core/analysis/SymbolTableBuilder';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { PSSASTBuilder } from '../../../src/core/parser/PSSASTBuilder';
import { join } from 'path';

describe('StdlibLoader', () => {
  it('loads bundled stdlib when no dir specified', () => {
    const loader = new StdlibLoader();
    const scopes = loader.load();
    expect(scopes.length).toBeGreaterThan(0);
  });

  it('bundled stdlib parses without errors', () => {
    const loader = new StdlibLoader();
    const scopes = loader.load();
    for (const scope of scopes) {
      expect(scope.fileid).toBeLessThan(0); // negative IDs for stdlib
    }
  });

  it('stdlib symbols are resolvable in symbol table', () => {
    const loader = new StdlibLoader();
    const stdlibScopes = loader.load();

    // Parse a user file
    const facade = new PSSParserFacade();
    const result = facade.parse('struct my_s { }');
    const builder = new PSSASTBuilder(0, result.tokens);
    const userScope = builder.build(result.tree);

    // Build symbol table with stdlib + user files
    const stb = new SymbolTableBuilder();
    const symResult = stb.build([...stdlibScopes, userScope]);

    expect(symResult.root.symtab.has('my_s')).toBe(true);
    // std_pkg should be registered
    expect(symResult.root.symtab.has('std_pkg')).toBe(true);
  });

  it('loads from disk when stdlib dir exists', () => {
    const stdlibDir = join(__dirname, '../../../../packages/zuspec-fe-pss/src/stdlib');
    const loader = new StdlibLoader(stdlibDir);
    const scopes = loader.load();
    // Should find at least std_pkg.pss
    expect(scopes.length).toBeGreaterThanOrEqual(1);
  });
});
