
import {ANTLRInputStream, CommonTokenStream, ANTLRErrorListener, Recognizer, RecognitionException, Token } from 'antlr4ts';
import {PSSParser} from '../antlr_gen/PSSParser';
import {PSSLexer} from '../antlr_gen/PSSLexer';
import { Override } from 'antlr4ts/Decorators';
import { ParserATNSimulator } from 'antlr4ts/atn/ParserATNSimulator';
import { Marker } from './Marker';

export class CUParser implements ANTLRErrorListener<Token> {
    private errors : Marker[] = [];

    public parse(content : string) : Marker[] {
        this.errors = [];
        let inputStream = new ANTLRInputStream(content);
        let lexer = new PSSLexer(inputStream);
        let tokenStream = new CommonTokenStream(lexer);
        let parser = new PSSParser(tokenStream);

        parser.removeErrorListeners();
        parser.addErrorListener(this);

        let root = parser.compilation_unit();

        return this.errors;
    }

    syntaxError<T extends Token>(
        recognizer:         Recognizer<T, any>, 
        offendingSymbol:    T | undefined,
        line:               number, 
        charPositionInLine: number, 
        msg:                string,
		e:                  RecognitionException|undefined): void {
        console.log("SyntaxError " + offendingSymbol);
        this.errors.push(new Marker(
            line,
            charPositionInLine,
            offendingSymbol.text.length,
            msg));
    }

}
