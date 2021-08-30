import { parseJsonc as parseJsonc_ } from './deps_cli.ts';

// deno-lint-ignore no-explicit-any
export function parseJsonc(input: string, errors?: ParseError[], options?: ParseOptions): any {
	return parseJsonc_(input, errors, options);
}

export function formatParseError(error: ParseError, input: string): string {
	const { error: code, offset, length } = error;
	let problem = escapeForPrinting(input.substring(offset, offset + length));
	if (problem.length < 10) {
		const contextSize = 10;
		problem = escapeForPrinting(input.substring(Math.max(offset - contextSize, 0), Math.min(offset + length + contextSize, input.length)));
	}
    return `${parseErrorCodeToString(code)} at ${offset}: ${problem}`;
}

export function parseErrorCodeToString(code: ParseErrorCode): string {
	switch (code) {
		case ParseErrorCode.InvalidSymbol: return 'InvalidSymbol'; 
		case ParseErrorCode.InvalidNumberFormat: return 'InvalidNumberFormat';
		case ParseErrorCode.PropertyNameExpected: return 'PropertyNameExpected';
		case ParseErrorCode.ValueExpected: return 'ValueExpected';
		case ParseErrorCode.ColonExpected: return 'ColonExpected';
		case ParseErrorCode.CommaExpected: return 'CommaExpected';
		case ParseErrorCode.CloseBraceExpected: return 'CloseBraceExpected';
		case ParseErrorCode.CloseBracketExpected: return 'CloseBracketExpected';
		case ParseErrorCode.EndOfFileExpected: return 'EndOfFileExpected';
		case ParseErrorCode.InvalidCommentToken: return 'InvalidCommentToken';
		case ParseErrorCode.UnexpectedEndOfComment: return 'UnexpectedEndOfComment';
		case ParseErrorCode.UnexpectedEndOfString: return 'UnexpectedEndOfString';
		case ParseErrorCode.UnexpectedEndOfNumber: return 'UnexpectedEndOfNumber';
		case ParseErrorCode.InvalidUnicode: return 'InvalidUnicode';
		case ParseErrorCode.InvalidEscapeCharacter: return 'InvalidEscapeCharacter';
		case ParseErrorCode.InvalidCharacter: return 'InvalidCharacter';
	}
	return `<unknown ParseErrorCode ${code}>`;
}

//

function escapeForPrinting(input: string): string {
	return input.replaceAll('\r', '\\r').replaceAll('\n', '\\n');
}

//

export interface ParseOptions {
	disallowComments?: boolean;
	allowTrailingComma?: boolean;
	allowEmptyContent?: boolean;
}

export interface ParseError {
	error: ParseErrorCode;
	offset: number;
	length: number;
}

export const enum ParseErrorCode {
	InvalidSymbol = 1,
	InvalidNumberFormat = 2,
	PropertyNameExpected = 3,
	ValueExpected = 4,
	ColonExpected = 5,
	CommaExpected = 6,
	CloseBraceExpected = 7,
	CloseBracketExpected = 8,
	EndOfFileExpected = 9,
	InvalidCommentToken = 10,
	UnexpectedEndOfComment = 11,
	UnexpectedEndOfString = 12,
	UnexpectedEndOfNumber = 13,
	InvalidUnicode = 14,
	InvalidEscapeCharacter = 15,
	InvalidCharacter = 16
}
