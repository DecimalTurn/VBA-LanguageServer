import 'reflect-metadata';
import '../extensions/stringExtensions';

import { describe, it } from 'mocha';
import * as assert from 'assert';
import { CompletionItemKind, Position, Range } from 'vscode-languageserver';

import { AssignmentType, ScopeItemCapability, ScopeType } from '../capabilities/capabilities';
import { getCompletionItems } from '../capabilities/completion';

function createElement(name: string, uri: string, range: Range) {
    return {
        context: {
            range,
            document: { uri }
        },
        identifierCapability: {
            name,
            range
        }
    } as any;
}

describe('ScopeItemCapability module lookup by URI', () => {
    it('resolves declaration location when module name differs from filename', () => {
        const projectScope = new ScopeItemCapability(undefined, ScopeType.PROJECT);

        const moduleUri = 'file:///c:/sample/project/Somethings.bas';
        const moduleScope = new ScopeItemCapability(
            createElement('Something', moduleUri, Range.create(0, 0, 20, 0)),
            ScopeType.MODULE,
            AssignmentType.NONE,
            projectScope
        );
        moduleScope.locationUri = moduleUri;

        const declaration = new ScopeItemCapability(
            createElement('Test', moduleUri, Range.create(2, 0, 4, 0)),
            ScopeType.SUBROUTINE,
            AssignmentType.NONE,
            moduleScope
        );
        declaration.locationUri = moduleUri;

        const reference = new ScopeItemCapability(
            createElement('Test', moduleUri, Range.create(10, 18, 10, 22)),
            ScopeType.REFERENCE,
            AssignmentType.CALL,
            moduleScope
        );
        reference.locationUri = moduleUri;
        reference.link = declaration;

        moduleScope.references = new Map([
            ['Test', [reference]]
        ]);

        projectScope.modules = new Map([
            ['Something', [moduleScope]]
        ]);

        const locationLinks = projectScope.getDeclarationLocation(
            moduleUri,
            Position.create(10, 19)
        );

        assert.ok(locationLinks, 'Expected declaration location results');
        assert.strictEqual(locationLinks?.length, 1, 'Expected one declaration location');
        assert.strictEqual(locationLinks?.[0].targetUri, moduleUri, 'Expected location to resolve to module URI');
    });
});


describe('Completion provider', () => {
    const uri = 'file:///c:/project/Module1.bas';

    function buildProjectScope() {
        const projectScope = new ScopeItemCapability(undefined, ScopeType.PROJECT);

        const moduleScope = new ScopeItemCapability(
            createElement('Module1', uri, Range.create(0, 0, 50, 0)),
            ScopeType.MODULE,
            AssignmentType.NONE,
            projectScope
        );
        moduleScope.locationUri = uri;

        const subItem = new ScopeItemCapability(
            createElement('MySubroutine', uri, Range.create(5, 0, 10, 0)),
            ScopeType.SUBROUTINE,
            AssignmentType.NONE,
            moduleScope
        );
        subItem.isPublicScope = true;
        subItem.locationUri = uri;

        const fnItem = new ScopeItemCapability(
            createElement('MyFunction', uri, Range.create(12, 0, 18, 0)),
            ScopeType.FUNCTION,
            AssignmentType.NONE,
            moduleScope
        );
        fnItem.isPublicScope = true;
        fnItem.locationUri = uri;

        moduleScope.subroutines = new Map([['MySubroutine', [subItem]]]);
        moduleScope.functions = new Map([['MyFunction', [fnItem]]]);

        projectScope.modules = new Map([['Module1', [moduleScope]]]);
        projectScope.implicitDeclarations = new Map([
            ['MySubroutine', [subItem]],
            ['MyFunction', [fnItem]]
        ]);

        return projectScope;
    }

    it('returns public members for member-access completion (e.g. "Module1.")', () => {
        const projectScope = buildProjectScope();
        const items = getCompletionItems(
            {
                textDocument: { uri },
                position: Position.create(0, 8),
                context: { triggerKind: 2, triggerCharacter: '.' }
            },
            projectScope,
            'Module1.'
        );

        assert.ok(items.length >= 2, 'Expected at least 2 completion items');
        const labels = items.map(i => i.label);
        assert.ok(labels.includes('MySubroutine'), 'Expected MySubroutine in completions');
        assert.ok(labels.includes('MyFunction'), 'Expected MyFunction in completions');
        items.forEach(item => {
            assert.ok(
                item.kind === CompletionItemKind.Function,
                `Expected Function kind, got ${item.kind}`
            );
        });
    });

    it('returns in-scope names for ambient completion (no dot)', () => {
        const projectScope = buildProjectScope();
        const items = getCompletionItems(
            {
                textDocument: { uri },
                position: Position.create(20, 5),
                context: { triggerKind: 1 }
            },
            projectScope,
            '\n'.repeat(20) + 'MySub'
        );

        const labels = items.map(i => i.label);
        assert.ok(labels.includes('Module1'), 'Expected Module1 module name in ambient completions');
    });

    it('getPublicMembers returns only public items', () => {
        const projectScope = buildProjectScope();
        const moduleScope = projectScope.modules!.get('Module1')![0];

        const privateItem = new ScopeItemCapability(
            createElement('PrivateSub', uri, Range.create(20, 0, 25, 0)),
            ScopeType.SUBROUTINE,
            AssignmentType.NONE,
            moduleScope
        );
        privateItem.isPublicScope = false;
        moduleScope.subroutines!.set('PrivateSub', [privateItem]);

        const members = moduleScope.getPublicMembers();
        const labels = members.map(m => m.label);
        assert.ok(labels.includes('MySubroutine'), 'Expected MySubroutine');
        assert.ok(labels.includes('MyFunction'), 'Expected MyFunction');
        assert.ok(!labels.includes('PrivateSub'), 'Should not include private sub');
    });

    it('ambient scope (application layer) members appear in completions', () => {
        const languageScope = new ScopeItemCapability(undefined, ScopeType.VBA);
        const appScope = new ScopeItemCapability(undefined, ScopeType.APPLICATION, undefined, languageScope);
        const projectScope = new ScopeItemCapability(
            createElement('Module1', uri, Range.create(0, 0, 50, 0)),
            ScopeType.PROJECT,
            AssignmentType.NONE,
            appScope
        );

        const moduleScope = new ScopeItemCapability(
            createElement('Module1', uri, Range.create(0, 0, 50, 0)),
            ScopeType.MODULE,
            AssignmentType.NONE,
            projectScope
        );
        moduleScope.locationUri = uri;
        projectScope.modules = new Map([['Module1', [moduleScope]]]);

        // Ambient module in app scope (simulates a .vbatype file).
        const ambientModuleScope = new ScopeItemCapability(
            createElement('Win32API', 'file:///c:/project/Win32API.vbatype', Range.create(0, 0, 10, 0)),
            ScopeType.MODULE,
            AssignmentType.NONE,
            appScope
        );
        ambientModuleScope.locationUri = 'file:///c:/project/Win32API.vbatype';
        const apiItem = new ScopeItemCapability(
            createElement('GetTickCount', 'file:///c:/project/Win32API.vbatype', Range.create(2, 0, 2, 30)),
            ScopeType.FUNCTION,
            AssignmentType.NONE,
            ambientModuleScope
        );
        apiItem.isPublicScope = true;
        ambientModuleScope.functions = new Map([['GetTickCount', [apiItem]]]);
        appScope.modules = new Map([['Win32API', [ambientModuleScope]]]);

        // Member-access on the ambient module.
        const items = getCompletionItems(
            {
                textDocument: { uri },
                position: Position.create(0, 9),
                context: { triggerKind: 2, triggerCharacter: '.' }
            },
            projectScope,
            'Win32API.'
        );

        const labels = items.map(i => i.label);
        assert.ok(labels.includes('GetTickCount'), 'Expected GetTickCount from ambient .vbatype scope');
    });
});
