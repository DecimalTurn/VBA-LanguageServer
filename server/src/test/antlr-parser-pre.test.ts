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
        console.log('    🔤 Tokens:');
        result.tokenInfo.forEach((t, i) => {
            const displayText = t.text.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
            console.log(`      ${i.toString().padStart(2)}: ${t.typeName.padEnd(12)} = "${displayText}"`);
        });
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
        const testFilePath = path.join(__dirname, '../../../test/parser/pre/ParsingParentheses.bas');
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