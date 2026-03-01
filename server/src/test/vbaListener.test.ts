import 'reflect-metadata';
import { describe, it } from 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import dedent from 'dedent';
import { container } from 'tsyringe';
import { CancellationTokenSource, MessageType } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import '../extensions/antlrCoreExtensions';
import '../extensions/antlrVbaParserExtensions';
import '../extensions/stringExtensions';

import { ScopeItemCapability, ScopeType } from '../capabilities/capabilities';
import { BaseProjectDocument } from '../project/document';

type LogNotification = {
    type: number;
    message: string;
    level: number;
};

const ERROR_LOG_TYPE = MessageType.Error;

function assertNoErrorLogs(logs: LogNotification[], context: string): void {
    const errorLogs = logs.filter(log => log.type === ERROR_LOG_TYPE);

    assert.strictEqual(
        errorLogs.length,
        0,
        `${context} produced error logs: ${errorLogs.map(x => x.message).join(' | ')}`
    );
}

function findScopeItem(
    root: ScopeItemCapability,
    predicate: (item: ScopeItemCapability) => boolean
): ScopeItemCapability | undefined {
    if (predicate(root)) {
        return root;
    }

    for (const map of root.maps) {
        for (const items of map.values()) {
            for (const item of items) {
                const result = findScopeItem(item, predicate);
                if (result) {
                    return result;
                }
            }
        }
    }

    return undefined;
}

function registerTestServices(logs: LogNotification[]): void {
    container.clearInstances();

    container.registerInstance('_Connection', {
        sendNotification: (_method: string, payload: LogNotification) => logs.push(payload)
    } as any);

    container.registerInstance('ILanguageServer', {
        clientConfiguration: Promise.resolve({
            maxDocumentLines: 50000,
            maxNumberOfProblems: 100,
            doWarnOptionExplicitMissing: true,
            environment: { os: 'test', version: 'test' },
            logLevel: { outputChannel: 'debug' }
        })
    } as any);

    container.registerInstance('IWorkspace', {
        clearDocumentsConfiguration: () => undefined,
        formatParseDocument: async () => undefined,
        parseDocument: async () => undefined,
        openDocument: () => undefined,
        closeDocument: () => undefined,
        addWorkspaceFolder: async () => undefined
    } as any);

    const languageScope = new ScopeItemCapability(undefined, ScopeType.VBA);
    const appScope = new ScopeItemCapability(undefined, ScopeType.APPLICATION, undefined, languageScope);
    const projectScope = new ScopeItemCapability(undefined, ScopeType.PROJECT, undefined, appScope);
    container.registerInstance('ProjectScope', projectScope);
}

async function parseText(uri: string, text: string, logs: LogNotification[]): Promise<void> {
    registerTestServices(logs);
    const textDocument = TextDocument.create(uri, 'vba', 1, text);
    const projectDocument = BaseProjectDocument.create(textDocument);
    await projectDocument.parse(new CancellationTokenSource().token);
}

describe('VBA Listener Integration', () => {
    it('does not log optional parameter identifiers as unresolved names', async () => {
        const logs: LogNotification[] = [];
        const vbaCode = dedent`
            Attribute VB_Name = "ScopeDiagnostics"

            Option Explicit

            Public Sub TestSub(Optional test_param As Variant = -0.1)
            Attribute TestSub.VB_Description = "docstring."
            End Sub
        `;

        await parseText('file:///test/ScopeDiagnostics.bas', vbaCode, logs);

        assertNoErrorLogs(logs, 'Optional parameter parse');
    });

    it('does not log ParamArray identifiers as unresolved names', async () => {
        const logs: LogNotification[] = [];
        const vbaCode = dedent`
            Attribute VB_Name = "ParamArrayTest"

            Option Explicit

            Public Sub TestVariadicSub(ParamArray args() As Variant)
            End Sub
        `;

        await parseText('file:///test/ParamArrayTest.bas', vbaCode, logs);

        assertNoErrorLogs(logs, 'ParamArray parse');
    });

    it('does not log errors for worksheet assignment', async () => {
        const logs: LogNotification[] = [];
        const vbaCode = dedent`
            Attribute VB_Name = "aaaaaaaaa"

            option explicit

            Public Sub Identifier()

                dim g_vouTempSht As Worksheet
                Set g_vouTempSht = g_wb.sheets("科目表")
            End Sub
        `;

        await parseText('file:///test/WorksheetAssignment.bas', vbaCode, logs);

        const projectScope = container.resolve<ScopeItemCapability>('ProjectScope');
        const subroutineScope = findScopeItem(projectScope, item =>
            item.type === ScopeType.SUBROUTINE && item.name === 'Identifier'
        );

        assert.ok(subroutineScope, 'Expected to resolve subroutine scope for Identifier');

        const variableScope = findScopeItem(projectScope, item =>
            item.type === ScopeType.VARIABLE
            && item.name === 'g_vouTempSht'
            && item.parent?.name === 'Identifier'
        );

        assert.ok(variableScope, 'Expected to resolve variable scope for g_vouTempSht');
        assert.strictEqual(variableScope?.name, 'g_vouTempSht');
        assert.strictEqual(variableScope?.classTypeName, 'Worksheet');

        const variableReference = findScopeItem(projectScope, item =>
            item.type === ScopeType.REFERENCE
            && item.name === 'g_vouTempSht'
            && item.parent?.name === 'Identifier'
        );

        assert.ok(variableReference, 'Expected to resolve reference scope for g_vouTempSht');
        assert.strictEqual(variableReference?.link?.name, 'g_vouTempSht');
        assert.strictEqual(variableReference?.link?.type, ScopeType.VARIABLE);

        assertNoErrorLogs(logs, 'Worksheet assignment parse');
    });

    it('does not log errors for ExternalTypeReferences fixture', async () => {
        const logs: LogNotification[] = [];
        const fixturePath = path.join(__dirname, '../../../test/fixtures/ExternalTypeReferences.bas');
        const vbaCode = fs.readFileSync(fixturePath, 'utf8');

        await parseText('file:///test/ExternalTypeReferences.bas', vbaCode, logs);

        assertNoErrorLogs(logs, 'ExternalTypeReferences fixture parse');
    });
    
});
