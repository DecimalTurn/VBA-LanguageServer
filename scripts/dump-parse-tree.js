/**
 * This script is used to parse a VBA source file and dump the parse tree and related information to an output file.
 * It takes two command-line arguments: the input file path and the output file path.
 * Example usage:
 * node ./scripts/dump-parse-tree.js ./test/fixtures/parse-tree/fixture.bas ./test/fixtures/parse-tree/output.txt
 */

const fs = require('node:fs');
const path = require('node:path');
const inspect = require('node:util').inspect;

function usage() {
	console.log('Usage: node ./scripts/dump-parse-tree.js <input-file> <output-file>');
}

function formatConsoleArgs(args) {
	return args
		.map((value) => (typeof value === 'string' ? value : inspect(value, { depth: null, colors: false })))
		.join(' ');
}

function parseAndGetErrors(input, VbaLexer, VbaParser, CharStream, CommonTokenStream) {
	const inputStream = CharStream.fromString(input);
	const lexer = new VbaLexer(inputStream);
	const tokens = new CommonTokenStream(lexer);
	const parser = new VbaParser(tokens);

	const errors = [];
	const lexerErrors = [];
	const tokenInfo = [];

	lexer.removeErrorListeners();
	parser.removeErrorListeners();

	tokens.fill();
	const allTokens = tokens.getTokens();
	for (const token of allTokens) {
		if (token.type !== -1) {
			const typeName = lexer.vocabulary.getSymbolicName(token.type) || `T__${token.type - 1}`;
			tokenInfo.push({
				type: token.type,
				text: token.text || '',
				typeName,
			});
		}
	}

	let parseTree = null;
	try {
		parseTree = parser.module_();
	} catch (error) {
		errors.push(`Parse exception: ${error}`);
	}

	return {
		errors,
		lexerErrors,
		tokenInfo,
		syntaxErrors: parser.numberOfSyntaxErrors,
		parseTree,
	};
}

function main() {
	const [inputArg, outputArg] = process.argv.slice(2);
	if (!inputArg || !outputArg) {
		usage();
		process.exit(1);
	}

	const inputPath = path.resolve(inputArg);
	const outputPath = path.resolve(outputArg);

	if (!fs.existsSync(inputPath)) {
		console.error(`Input file does not exist: ${inputPath}`);
		process.exit(1);
	}

	process.env.VBA_TEST_VERBOSE = process.env.VBA_TEST_VERBOSE || '1';

	let parserModule;
	let antlr;
	let parserUtils;
	try {
		parserModule = require('../server/out/project/parser/vbaAntlr');
		antlr = require('antlr4ng');
		parserUtils = require('../server/out/test/util');
	} catch (error) {
		console.error('Could not load compiled parser/test utility modules.');
		console.error('Run `npm run build` (or `npm run test`) first, then rerun this script.');
		console.error(error);
		process.exit(1);
	}

	const { VbaLexer, VbaParser } = parserModule;
	const { CharStream, CommonTokenStream } = antlr;
	const { checkImplicitTokens, logParsingResults } = parserUtils;

	const inputText = fs.readFileSync(inputPath, 'utf8');
	const result = parseAndGetErrors(inputText, VbaLexer, VbaParser, CharStream, CommonTokenStream);

	const capturedLines = [];
	const originalLog = console.log;
	console.log = (...args) => {
		capturedLines.push(formatConsoleArgs(args));
	};

	try {
		logParsingResults(inputText, result);
		const implicitTokens = checkImplicitTokens(result);
		capturedLines.push('');
		capturedLines.push(`Input file: ${inputPath}`);
		capturedLines.push(`Syntax errors: ${result.syntaxErrors}`);
		capturedLines.push(`Parser exceptions: ${result.errors.length}`);
		capturedLines.push(`Lexer errors: ${result.lexerErrors.length}`);
		capturedLines.push(`Implicit tokens: ${implicitTokens.length}`);
	} finally {
		console.log = originalLog;
	}

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, `${capturedLines.join('\n')}\n`, 'utf8');

	console.log(`Wrote parse tree report to: ${outputPath}`);
}

main();