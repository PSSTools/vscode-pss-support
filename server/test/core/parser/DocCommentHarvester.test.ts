import { describe, it, expect } from 'vitest';
import { PSSParserFacade } from '../../../src/core/parser/PSSParserFacade';
import { DocCommentHarvester } from '../../../src/core/parser/DocCommentHarvester';

describe('DocCommentHarvester', () => {
  const facade = new PSSParserFacade();

  function harvestFirstDecl(source: string): string | undefined {
    const result = facade.parse(source);
    result.tokens.fill();
    const harvester = new DocCommentHarvester(result.tokens);
    // Find the first non-hidden token after the comment
    const tokens = result.tokens.getTokens();
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].channel === 0 && tokens[i].type !== -1) {
        return harvester.harvest(i);
      }
    }
    return undefined;
  }

  it('extracts multi-line doc comment', () => {
    const doc = harvestFirstDecl('/** doc */\naction a {}');
    expect(doc).toBe(' doc ');
  });

  it('extracts single-line comment', () => {
    const doc = harvestFirstDecl('// line comment\naction a {}');
    expect(doc).toBe(' line comment');
  });

  it('returns undefined when no comment', () => {
    const doc = harvestFirstDecl('action a {}');
    expect(doc).toBeUndefined();
  });
});
