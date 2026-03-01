/**
 * Direct ANTLR parser test for VBA main grammar.
 * 
 * This test directly uses the ANTLR parser to catch syntax errors and undesired implicit tokens (T__1, T__2, etc.)
 * without going through the VS Code diagnostics layer.
 */

import { describe, it } from 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { VbaParser, VbaLexer } from '../project/parser/vbaAntlr';
import { CharStream, CommonTokenStream } from 'antlr4ng';
import { checkImplicitTokens, logParsingResults, ParseResult, shouldLogDetails, verboseTestLogs } from './util';

describe('ANTLR VBA Main Parser', () => {
    /**
     * Test helper to parse input and collect syntax errors
     */
    function parseAndGetErrors(input: string): ParseResult {
        const inputStream = CharStream.fromString(input);
        const lexer = new VbaLexer(inputStream);
        const tokens = new CommonTokenStream(lexer);
        const parser = new VbaParser(tokens);
        
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
        
        // Try to parse as a module
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
            parseTree
        };
    }
    
    it('should parse VBA code with external type references without errors', () => {
        const testFilePath = path.join(__dirname, '../../../test/fixtures/ExternalTypeReferences.bas');
        const input = fs.readFileSync(testFilePath, 'utf8');
        
        const result = parseAndGetErrors(input);
        const implicitTokens = checkImplicitTokens(result);

        if (shouldLogDetails(result, implicitTokens)) {
            logParsingResults(input, result);
        }
        
        // The test should pass even with external type references like Dictionary, Excel.Application, etc.
        assert.strictEqual(result.syntaxErrors, 0, `Expected no syntax errors, but found: ${result.errors.join(', ')}`);
        
        // Ensure our UnresolvedTypeReferenceElement solution works - no implicit tokens should be generated
        assert.strictEqual(implicitTokens.length, 0, `Found implicit tokens: ${implicitTokens.map(t => t.typeName).join(', ')}`);

        if (verboseTestLogs) {
            console.log('    ✅ Successfully parsed VBA code with external type references (Dictionary, Excel.Application, etc.)');
        }
    });
    

});