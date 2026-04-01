import {
  CharStream,
  CommonTokenStream,
  BaseErrorListener,
  RecognitionException,
  Recognizer,
  Token,
  ATNSimulator,
} from 'antlr4ng';
import { PSSLexer } from '../../generated/PSSLexer.js';
import { PSSParser, Compilation_unitContext } from '../../generated/PSSParser.js';
import { Diagnostic, DiagnosticSeverity } from '../types/Diagnostic';

export interface ParseResult {
  tree: Compilation_unitContext;
  tokens: CommonTokenStream;
  errors: Diagnostic[];
}

class CollectingErrorListener extends BaseErrorListener {
  public readonly diagnostics: Diagnostic[] = [];

  public override syntaxError<S extends Token, T extends ATNSimulator>(
    _recognizer: Recognizer<T>,
    offendingSymbol: S | null,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: RecognitionException | null,
  ): void {
    const length = offendingSymbol?.text?.length ?? 1;
    this.diagnostics.push({
      range: {
        start: { line: line - 1, character: charPositionInLine },
        end: { line: line - 1, character: charPositionInLine + length },
      },
      severity: DiagnosticSeverity.Error,
      code: 'syntax-error',
      source: 'pss',
      message: msg,
    });
  }
}

export class PSSParserFacade {
  public parse(content: string, _fileId: number = 0): ParseResult {
    const inputStream = CharStream.fromString(content);
    const lexer = new PSSLexer(inputStream);

    const lexerErrors = new CollectingErrorListener();
    lexer.removeErrorListeners();
    lexer.addErrorListener(lexerErrors);

    const tokenStream = new CommonTokenStream(lexer);

    const parser = new PSSParser(tokenStream);
    const parserErrors = new CollectingErrorListener();
    parser.removeErrorListeners();
    parser.addErrorListener(parserErrors);

    const tree = parser.compilation_unit();

    return {
      tree,
      tokens: tokenStream,
      errors: [...lexerErrors.diagnostics, ...parserErrors.diagnostics],
    };
  }
}
