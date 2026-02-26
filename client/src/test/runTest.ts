/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as fs from 'fs';

import { runTests } from '@vscode/test-electron';

async function main() {
	try {
		const workspaceRootFromDist = path.resolve(__dirname, '../../../../');
		const workspaceRootFromSrc = path.resolve(__dirname, '../../../');
		const workspaceRoot = fs.existsSync(path.join(workspaceRootFromDist, 'package.json'))
			? workspaceRootFromDist
			: workspaceRootFromSrc;

		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = workspaceRoot;

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(workspaceRoot, 'dist/client/out/test/index.js');

		// Download VS Code, unzip it and run the integration test
		await runTests({ extensionDevelopmentPath, extensionTestsPath });
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();
