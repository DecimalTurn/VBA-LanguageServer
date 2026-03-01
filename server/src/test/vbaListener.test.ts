import 'reflect-metadata';
import { describe, it } from 'mocha';
import * as assert from 'assert';
import dedent from 'dedent';
import { container } from 'tsyringe';
import { CancellationTokenSource } from 'vscode-languageserver';
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

const ERROR_LOG_TYPE = 1;

function assertNoErrorLogs(logs: LogNotification[], context: string): void {
    const errorLogs = logs.filter(log => log.type === ERROR_LOG_TYPE);

    assert.strictEqual(
        errorLogs.length,
        0,
        `${context} produced error logs: ${errorLogs.map(x => x.message).join(' | ')}`
    );
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
});
