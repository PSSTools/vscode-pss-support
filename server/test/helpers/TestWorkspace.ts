import { PSSParserFacade, ParseResult } from '../../src/core/parser/PSSParserFacade';
import { SourcePosition } from '../../src/core/types/SourcePosition';

export class TestWorkspace {
  private files = new Map<string, string>();
  private parser = new PSSParserFacade();

  addFile(name: string, content: string): void {
    this.files.set(name, content);
  }

  parseOne(content: string): ParseResult {
    return this.parser.parse(content);
  }

  parseFile(name: string): ParseResult {
    const content = this.files.get(name);
    if (!content) throw new Error(`File not found: ${name}`);
    return this.parser.parse(content);
  }

  // Find position of a cursor marker (|) in the source text and return the position.
  cursorPosition(source: string): { cleanSource: string; position: SourcePosition } {
    const idx = source.indexOf('|');
    if (idx < 0) throw new Error('No cursor marker (|) found in source');
    const cleanSource = source.slice(0, idx) + source.slice(idx + 1);
    const lines = source.slice(0, idx).split('\n');
    return {
      cleanSource,
      position: {
        line: lines.length - 1,
        character: lines[lines.length - 1].length,
      },
    };
  }

  // Find position of a named marker in the source text.
  markerPosition(source: string, name: string): SourcePosition {
    const marker = '/*' + name + '*/';
    const idx = source.indexOf(marker);
    if (idx < 0) throw new Error('Marker ' + marker + ' not found in source');
    const lines = source.slice(0, idx).split('\n');
    return {
      line: lines.length - 1,
      character: lines[lines.length - 1].length,
    };
  }
}
