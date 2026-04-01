import { CommonTokenStream, Token } from 'antlr4ng';
import { PSSLexer } from '../../generated/PSSLexer.js';

const SL_COMMENT_CHANNEL = 11;
const ML_COMMENT_CHANNEL = 12;

/**
 * Extracts doc-comments immediately preceding a declaration token.
 */
export class DocCommentHarvester {
  private readonly tokens: CommonTokenStream;

  constructor(tokens: CommonTokenStream) {
    this.tokens = tokens;
  }

  /**
   * Scan backward from the given token index on comment channels to find
   * the doc-comment immediately preceding a declaration.
   * Returns the comment text (stripped of delimiters) or undefined.
   */
  public harvest(tokenIndex: number): string | undefined {
    // Fill all tokens so hidden channels are accessible
    this.tokens.fill();
    const allTokens = this.tokens.getTokens();

    // Walk backward from just before the given token
    for (let i = tokenIndex - 1; i >= 0; i--) {
      const tok = allTokens[i];
      if (tok.channel === ML_COMMENT_CHANNEL) {
        return this.stripMultiLineComment(tok.text ?? '');
      }
      if (tok.channel === SL_COMMENT_CHANNEL) {
        return this.stripSingleLineComment(tok.text ?? '');
      }
      // Skip whitespace (channel 10)
      if (tok.channel === 10) {
        continue;
      }
      // Hit a real token - no doc comment
      break;
    }
    return undefined;
  }

  private stripMultiLineComment(text: string): string {
    // Remove /* and */ delimiters
    let inner = text;
    if (inner.startsWith('/**')) inner = inner.slice(3);
    else if (inner.startsWith('/*')) inner = inner.slice(2);
    if (inner.endsWith('*/')) inner = inner.slice(0, -2);

    // Strip leading ` * ` prefix from each line (javadoc style)
    const lines = inner.split('\n').map(line => {
      const stripped = line.replace(/^\s*\*\s?/, '');
      return stripped;
    });

    // Drop leading/trailing blank lines
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

    return lines.join('\n');
  }

  private stripSingleLineComment(text: string): string {
    let inner = text;
    if (inner.startsWith('//')) inner = inner.slice(2);
    // Remove trailing newline
    inner = inner.replace(/\r?\n$/, '');
    return inner;
  }
}
