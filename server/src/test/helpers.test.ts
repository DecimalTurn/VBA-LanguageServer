import 'reflect-metadata';

import { describe, it } from 'mocha';
import * as assert from 'assert';
import dedent from 'dedent';
import { SymbolKind } from 'vscode-languageserver';

import { getMissingSymbolsLogSeverity, shouldHaveSymbols } from '../utils/helpers';

describe('Helpers symbol classification', () => {
    it('does not flag legitimate no-symbol module content', () => {
        const moduleText = dedent`
            Option Explicit
            Attribute VB_Name = "Module1"
            ' comment
            Rem comment
            #If VBA7 Then
            #Else
            #End If
        `;

        const result = shouldHaveSymbols(moduleText);

        assert.strictEqual(result, false, 'Expected legitimate directive-only content to skip missing-symbol error logging');
    });

    it('flags substantive code with empty symbol list', () => {
        const moduleText = dedent`
            Option Explicit
            Public Sub Test()
            End Sub
        `;

        const result = shouldHaveSymbols(moduleText);

        assert.strictEqual(result, true, 'Expected substantive code to be flagged when symbols are missing');
    });

    it('does not flag a procedure wrapped in conditional compilation', () => {
        const moduleText = dedent`
            Option Explicit
            #If Win64 Then
            Public Sub ConditionalProc()
            End Sub
            #End If
        `;

        const result = shouldHaveSymbols(moduleText);

        assert.strictEqual(result, false, 'Expected conditional-compilation-only procedures to be treated as legitimate zero-symbol content');
    });
});

describe('Helpers missing-symbol log severity', () => {
    it('returns error when no symbols are produced at all', () => {
        const moduleText = dedent`
            Option Explicit
            Public Sub Test()
            End Sub
        `;

        const severity = getMissingSymbolsLogSeverity(
            moduleText,
            []
        );

        assert.strictEqual(severity, 'error');
    });

    it('returns warn when only module symbol exists but member symbols are expected', () => {
        const moduleText = dedent`
            Option Explicit
            Public Sub Test()
            End Sub
        `;

        const severity = getMissingSymbolsLogSeverity(
            moduleText,
            [{ kind: SymbolKind.File }]
        );

        assert.strictEqual(severity, 'warn');
    });

    it('returns none when only module symbol exists and content is legitimately non-symbolic', () => {
        const moduleText = dedent`
            Attribute VB_Name = "Module1"
            Option Explicit
        `;

        const severity = getMissingSymbolsLogSeverity(
            moduleText,
            [{ kind: SymbolKind.File }]
        );

        assert.strictEqual(severity, 'none');
    });

    it('returns none when only module symbol exists and procedures are in inactive compiler branch', () => {
        const moduleText = dedent`
            Option Explicit
            #If Win64 Then
            #Else
            Public Sub ConditionalProc()
            End Sub
            #End If
        `;

        const severity = getMissingSymbolsLogSeverity(
            moduleText,
            [{ kind: SymbolKind.File }]
        );

        assert.strictEqual(severity, 'none');
    });

    it('returns none when member symbols are present', () => {
        const moduleText = dedent`
            Option Explicit
            Public Sub Test()
            End Sub
        `;

        const severity = getMissingSymbolsLogSeverity(
            moduleText,
            [{ kind: SymbolKind.File }, { kind: SymbolKind.Method }]
        );

        assert.strictEqual(severity, 'none');
    });
});
