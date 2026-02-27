/**
 * Direct ANTLR parser test for VBA preprocessor grammar.
 * 
 * This test directly uses the ANTLR parser to catch syntax errors and undesired implicit tokens (T__1, T__2, etc.)
 * without going through the VS Code diagnostics layer.
 */

import { describe, it } from 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { VbaPreParser, VbaPreLexer } from '../project/parser/vbaAntlr';
import { CharStream, CommonTokenStream } from 'antlr4ng';

describe('ANTLR VBA Preprocessor Parser', () => {
    
    /**
     * Helper function to check and report implicit tokens
     */
    function checkImplicitTokens(result: ReturnType<typeof parseAndGetErrors>): Array<{type: number, text: string, typeName: string}> {
        const implicitTokens = result.tokenInfo.filter(t => t.typeName.startsWith('T__'));
        if (implicitTokens.length > 0) {
            console.log(`    ❌ Found ${implicitTokens.length} implicit token(s): ${implicitTokens.map(t => t.typeName).join(', ')}`);
        } else {
            console.log('    ✅ No implicit tokens found');
        }
        return implicitTokens;
    }

    /**
     * Helper function to create a hierarchical tree view of the parse tree
     */
    function logParseTree(parseTree: any, indent: string = '    ', isLast: boolean = true): void {
        if (!parseTree) return;
        
        const nodeType = parseTree.constructor.name || 'UnknownNode';
        const prefix = isLast ? '└── ' : '├── ';
        
        // If it's a terminal node (token), show the token value
        if (parseTree.symbol) {
            const token = parseTree.symbol;
            const displayText = (token.text || '').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            console.log(`${indent}${prefix}${nodeType} [${token.type}] = "${displayText}"`);
        } else {
            console.log(`${indent}${prefix}${nodeType}`);
        }
        
        // Recursively display children
        if (parseTree.children && parseTree.children.length > 0) {
            const childIndent = indent + (isLast ? '    ' : '│   ');
            parseTree.children.forEach((child: any, index: number) => {
                const isLastChild = index === parseTree.children.length - 1;
                logParseTree(child, childIndent, isLastChild);
            });
        }
    }

    /**
     * Helper function to create a hierarchical token view based on line structure
     */
    function logTokenHierarchy(input: string, tokenInfo: Array<{type: number, text: string, typeName: string}>): void {
        console.log('    🔗 Token Hierarchy:');
        
        const lines = input.split(/\r?\n/);
        const nonEmptyLines = lines.map((line, index) => ({ line, index })).filter(item => item.line.trim());
        let tokenIndex = 0;
        
        nonEmptyLines.forEach((lineItem, displayIndex) => {
            const { line, index: lineNum } = lineItem;
            const isLastLine = displayIndex === nonEmptyLines.length - 1;
            const linePrefix = isLastLine ? '└── ' : '├── ';
            
            console.log(`      ${linePrefix}Line ${lineNum + 1}: "${line}"`);
            
            // Find tokens that belong to this line
            const lineTokens: typeof tokenInfo = [];
            const currentPos = 0;
            
            // Simple heuristic to group tokens by line
            while (tokenIndex < tokenInfo.length) {
                const token = tokenInfo[tokenIndex];
                
                // If it's a newline token, we've reached the end of this line
                if (token.typeName === 'NEWLINE') {
                    tokenIndex++;
                    break;
                }
                
                lineTokens.push(token);
                tokenIndex++;
                
                // If we've processed all tokens, break
                if (tokenIndex >= tokenInfo.length) break;
            }
            
            // Display tokens for this line in a hierarchical manner
            lineTokens.forEach((token, idx) => {
                const isLastToken = idx === lineTokens.length - 1;
                const tokenPrefix = isLastToken ? '└── ' : '├── ';
                const lineConnector = isLastLine ? '    ' : '│   ';
                const displayText = token.text.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                console.log(`      ${lineConnector}${tokenPrefix}${token.typeName.padEnd(12)} = "${displayText}"`);
            });
        });
        
        // Handle any remaining tokens that weren't processed
        while (tokenIndex < tokenInfo.length) {
            const token = tokenInfo[tokenIndex];
            if (token.typeName === 'NEWLINE') {
                console.log(`      └── [End] NEWLINE = "${token.text.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`);
            }
            tokenIndex++;
        }
    }

    /**
     * Helper function to log parsing results consistently
     */
    function logParsingResults(input: string, result: ReturnType<typeof parseAndGetErrors>) {
        console.log('\n    📝 Input:');
        const inputLines = input.split('\n');
        inputLines.forEach((line, index) => {
            // Show line numbers and preserve exact whitespace
            if (line.trim() || index < inputLines.length - 1) { // Show non-empty lines and all but the last empty line
                console.log(`      ${(index + 1).toString().padStart(2)}: ${line}`);
            }
        });
        
        // Original flat token view
        console.log('    🔤 Tokens (Flat):');
        result.tokenInfo.forEach((t, i) => {
            const displayText = t.text.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            console.log(`      ${i.toString().padStart(2)}: ${t.typeName.padEnd(12)} = "${displayText}"`);
        });
        
        // New hierarchical token view
        logTokenHierarchy(input, result.tokenInfo);
        
        // Parse tree hierarchy (if available)
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
    
    /**
     * Test helper to parse input and collect syntax errors
     */
    function parseAndGetErrors(input: string) {
        const lexer = VbaPreLexer.create(input);
        const tokens = new CommonTokenStream(lexer);
        const parser = new VbaPreParser(tokens);
        
        // Collect all error information
        const errors: string[] = [];
        const lexerErrors: string[] = [];
        const tokenInfo: Array<{type: number, text: string, typeName: string}> = [];
        
        lexer.removeErrorListeners();
        parser.removeErrorListeners();
        
        // Get tokens for inspection
        tokens.fill();
        const allTokens = tokens.getTokens();
        for (const token of allTokens) {
            if (token.type !== -1) { // Skip EOF
                const typeName = lexer.vocabulary.getSymbolicName(token.type) || `T__${token.type - 1}`;
                tokenInfo.push({
                    type: token.type,
                    text: token.text || '',
                    typeName: typeName
                });
            }
        }
        
        // Try to parse
        let parseTree = null;
        try {
            parseTree = parser.startRule();
        } catch (error) {
            errors.push(`Parse exception: ${error}`);
        }
        
        return {
            errors,
            lexerErrors,
            tokenInfo,
            syntaxErrors: parser.numberOfSyntaxErrors,
            parseTree
        };
    }
    
    it('should parse function call with string literal and parentheses', () => {
        const testFilePath = path.join(__dirname, '../../../test/parser/pre/ParsingParenthesis.bas');
        const input = fs.readFileSync(testFilePath, 'utf8');
        
        const result = parseAndGetErrors(input);
        
        logParsingResults(input, result);
        const implicitTokens = checkImplicitTokens(result);
        
        // The test should fail if there are implicit T__ tokens for parentheses
        assert.strictEqual(result.syntaxErrors, 0, `Expected no syntax errors, but found: ${result.errors.join(', ')}`);
        assert.strictEqual(implicitTokens.length, 0, `Found implicit tokens: ${implicitTokens.map(t => t.typeName).join(', ')}`);
    });
    
    it('should parse multiple function calls correctly', () => {
        const testFilePath = path.join(__dirname, '../../../test/parser/pre/TwoFunctionCalls.bas');
        const input = fs.readFileSync(testFilePath, 'utf8');

        const result = parseAndGetErrors(input);

        logParsingResults(input, result);
        const implicitTokens = checkImplicitTokens(result);
        
        assert.strictEqual(result.syntaxErrors, 0);
        assert.strictEqual(implicitTokens.length, 0);
    });
    

});