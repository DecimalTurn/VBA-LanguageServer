import 'reflect-metadata';
import '../extensions/stringExtensions';

import { describe, it } from 'mocha';
import * as assert from 'assert';
import { Position, Range } from 'vscode-languageserver';

import { AssignmentType, ScopeItemCapability, ScopeType } from '../capabilities/capabilities';

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
