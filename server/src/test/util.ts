export type TokenInfo = {
    type: number;
    text: string;
    typeName: string;
};

export type ParseResult = {
    errors: string[];
    lexerErrors: string[];
    tokenInfo: TokenInfo[];
    syntaxErrors: number;
    parseTree: any;
};

export const verboseTestLogs = ['1', 'true', 'yes', 'on'].includes((process.env.VBA_TEST_VERBOSE ?? '').toLowerCase());

export function shouldLogDetails(result: ParseResult, implicitTokens: TokenInfo[]): boolean {
    return verboseTestLogs || result.syntaxErrors > 0 || result.errors.length > 0 || result.lexerErrors.length > 0 || implicitTokens.length > 0;
}

export function checkImplicitTokens(result: ParseResult): TokenInfo[] {
    const implicitTokens = result.tokenInfo.filter(t => t.typeName.startsWith('T__'));
    if (implicitTokens.length > 0) {
        console.log(`    ❌ Found ${implicitTokens.length} implicit token(s): ${implicitTokens.map(t => t.typeName).join(', ')}`);
    } else if (verboseTestLogs) {
        console.log('    ✅ No implicit tokens found');
    }
    return implicitTokens;
}

function logParseTree(parseTree: any, indent: string = '    ', isLast: boolean = true): void {
    if (!parseTree) return;

    const nodeType = parseTree.constructor.name || 'UnknownNode';
    const prefix = isLast ? '└── ' : '├── ';

    if (parseTree.symbol) {
        const token = parseTree.symbol;
        const displayText = (token.text || '').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        console.log(`${indent}${prefix}${nodeType} [${token.type}] = "${displayText}"`);
    } else {
        console.log(`${indent}${prefix}${nodeType}`);
    }

    if (parseTree.children && parseTree.children.length > 0) {
        const childIndent = indent + (isLast ? '    ' : '│   ');
        parseTree.children.forEach((child: any, index: number) => {
            const isLastChild = index === parseTree.children.length - 1;
            logParseTree(child, childIndent, isLastChild);
        });
    }
}

function logTokenHierarchy(input: string, tokenInfo: TokenInfo[]): void {
    console.log('    🔗 Token Hierarchy:');

    const lines = input.split(/\r?\n/);
    const nonEmptyLines = lines.map((line, index) => ({ line, index })).filter(item => item.line.trim());
    let tokenIndex = 0;

    nonEmptyLines.forEach((lineItem, displayIndex) => {
        const { line, index: lineNum } = lineItem;
        const isLastLine = displayIndex === nonEmptyLines.length - 1;
        const linePrefix = isLastLine ? '└── ' : '├── ';

        console.log(`      ${linePrefix}Line ${lineNum + 1}: "${line}"`);

        const lineTokens: TokenInfo[] = [];

        while (tokenIndex < tokenInfo.length) {
            const token = tokenInfo[tokenIndex];

            if (token.typeName === 'NEWLINE') {
                tokenIndex++;
                break;
            }

            lineTokens.push(token);
            tokenIndex++;

            if (tokenIndex >= tokenInfo.length) break;
        }

        lineTokens.forEach((token, idx) => {
            const isLastToken = idx === lineTokens.length - 1;
            const tokenPrefix = isLastToken ? '└── ' : '├── ';
            const lineConnector = isLastLine ? '    ' : '│   ';
            const displayText = token.text.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            console.log(`      ${lineConnector}${tokenPrefix}${token.typeName.padEnd(12)} = "${displayText}"`);
        });
    });

    while (tokenIndex < tokenInfo.length) {
        const token = tokenInfo[tokenIndex];
        if (token.typeName === 'NEWLINE') {
            console.log(`      └── [End] NEWLINE = "${token.text.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`);
        }
        tokenIndex++;
    }
}

export function logParsingResults(input: string, result: ParseResult): void {
    console.log('\n    📝 Input:');
    const inputLines = input.split('\n');
    inputLines.forEach((line, index) => {
        if (line.trim() || index < inputLines.length - 1) {
            console.log(`      ${(index + 1).toString().padStart(2)}: ${line}`);
        }
    });

    console.log('    🔤 Tokens (Flat):');
    result.tokenInfo.forEach((t, i) => {
        const displayText = t.text.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
        console.log(`      ${i.toString().padStart(2)}: ${t.typeName.padEnd(12)} = "${displayText}"`);
    });

    logTokenHierarchy(input, result.tokenInfo);

    if (result.parseTree) {
        console.log('    🌳 Parse Tree:');
        logParseTree(result.parseTree);
    }

    if (result.lexerErrors.length > 0) {
        console.log('    ❌ Lexer errors:', result.lexerErrors);
    }
    if (result.errors.length > 0) {
        console.log('    ❌ Parser errors:', result.errors);
    }
    console.log(`    📊 Syntax errors: ${result.syntaxErrors}`);
}