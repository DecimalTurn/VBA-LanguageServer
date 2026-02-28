import 'reflect-metadata';
import '../extensions/stringExtensions';

import { describe, it } from 'mocha';
import * as assert from 'assert';
import { container } from 'tsyringe';
import { CancellationTokenSource } from 'vscode-languageserver';

import { Workspace } from '../project/workspace';
import { ILanguageServer } from '../injection/interface';

function createMockConnection() {
    const disposable = { dispose: () => undefined };
    const on = () => disposable;

    return {
        onCodeAction: on,
        onCompletion: on,
        onCompletionResolve: on,
        onDefinition: on,
        onDidChangeConfiguration: on,
        onDidChangeWatchedFiles: on,
        onDidCloseTextDocument: on,
        onDocumentFormatting: on,
        onDocumentSymbol: on,
        onHover: on,
        onInitialized: on,
        onRenameRequest: on,
        onFoldingRanges: on,
        onRequest: on,
        onDidOpenTextDocument: on,
        onDidChangeTextDocument: on,
        onDidSaveTextDocument: on,
        onWillSaveTextDocument: on,
        onWillSaveTextDocumentWaitUntil: on,

        sendDiagnostics: () => undefined,
        sendNotification: () => undefined,

        workspace: {
            getConfiguration: async () => ({
                maxDocumentLines: 50000,
                maxNumberOfProblems: 100,
                doWarnOptionExplicitMissing: true,
                environment: { os: 'test', version: 'test' },
                logLevel: { outputChannel: 'debug' }
            }),
            onDidChangeWorkspaceFolders: on
        },
        languages: {
            diagnostics: {
                refresh: () => undefined
            }
        },
        client: {
            register: () => disposable
        }
    } as any;
}

function createMockServer(): ILanguageServer {
    return {
        configuration: {
            params: {
                capabilities: {
                    workspace: {
                        configuration: false,
                        workspaceFolders: false
                    }
                },
                workspaceFolders: []
            }
        } as any,
        clientConfiguration: Promise.resolve({
            maxDocumentLines: 50000,
            maxNumberOfProblems: 100,
            doWarnOptionExplicitMissing: true,
            environment: { os: 'test', version: 'test' },
            logLevel: { outputChannel: 'debug' }
        })
    };
}

describe('Workspace document replacement race', () => {
    it('returns the replacement document while waiting for busy parse to clear', async () => {
        container.clearInstances();

        const connection = createMockConnection();
        const server = createMockServer();

        container.registerInstance('_Connection', connection);
        container.registerInstance('ILanguageServer', server);

        const workspace = new Workspace(connection, server);

        const events = (workspace as any).events;
        const projectDocuments = (workspace as any).projectDocuments as Map<string, any>;

        const uri = 'file:///c:/tmp/replaced.bas';

        const oldBusyDocument = {
            textDocument: { version: 1 },
            isBusy: true
        } as any;

        const replacementDocument = {
            textDocument: { version: 2 },
            isBusy: false
        } as any;

        projectDocuments.set(uri, oldBusyDocument);

        const tokenSource = new CancellationTokenSource();
        const waitPromise = (events as any).getParsedProjectDocument(uri, 0, tokenSource.token);
        projectDocuments.set(uri, replacementDocument);

        try {
            const result = await Promise.race([
                waitPromise,
                new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 1000))
            ]);

            assert.notStrictEqual(result, 'timeout', 'Expected to resolve with replacement document, but request timed out');
            assert.strictEqual(result, replacementDocument, 'Expected to return the replacement tracked document instance');
        } finally {
            tokenSource.cancel();

            // Ensure no pending waiter keeps the test process alive when
            // assertions fail (e.g., when the replacement-refresh fix is absent).
            await Promise.race([
                waitPromise.catch(() => undefined),
                new Promise<void>(resolve => setTimeout(resolve, 300))
            ]);
        }
    });
});
