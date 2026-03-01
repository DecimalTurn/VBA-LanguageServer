/* * This script is used to run the ANTLR unit tests with verbose output.
 * It sets the VBA_TEST_VERBOSE environment variable to '1' to enable verbose logging in the tests.
 * The script uses spawnSync to run the npm command, which allows it to capture the output and exit code.
 * If there is an error during execution, it logs the error and exits with a non-zero code.
 * Otherwise, it exits with the status code returned by the npm command.
 */

const { spawnSync } = require('node:child_process');

const npmExecPath = process.env.npm_execpath;
const command = npmExecPath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const args = npmExecPath ? [npmExecPath, 'run', 'test:antlr:unit'] : ['run', 'test:antlr:unit'];

const result = spawnSync(command, args, {
	stdio: 'inherit',
	env: {
		...process.env,
		VBA_TEST_VERBOSE: '1',
	},
});

if (result.error) {
	console.error(result.error);
	process.exit(1);
}

process.exit(result.status ?? 1);
