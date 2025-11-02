#!/usr/bin/env node

const { execSync } = require('child_process');

/**
 * Smart script to run VS Code tests with automatic headless environment detection
 */
function runVSCodeTests() {
    // Detect if we're in a headless environment
    const hasDisplay = !!process.env.DISPLAY;
    const isCI = process.env.CI === 'true';
    const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
    const isCodespaces = process.env.CODESPACES === 'true';
    const isRemoteContainers = process.env.REMOTE_CONTAINERS === 'true';
    
    const isHeadless = !hasDisplay || isCI || isGitHubActions || isCodespaces || isRemoteContainers;
    
    console.log(`🔍 Environment: ${isHeadless ? 'headless' : 'display available'}`);
    
    if (isHeadless) {
        // Try to use xvfb-run for headless environments
        try {
            execSync('which xvfb-run', { stdio: 'ignore' });
            console.log('✅ Using xvfb-run for headless testing');
            execSync('xvfb-run -a vscode-test', { stdio: 'inherit' });
        } catch (error) {
            console.log('⚠️  xvfb-run not available, trying direct execution');
            try {
                execSync('vscode-test', { stdio: 'inherit' });
            } catch (testError) {
                console.error('❌ VS Code tests failed:', testError.message);
                process.exit(1);
            }
        }
    } else {
        // Normal environment with display
        console.log('✅ Running tests with display');
        try {
            execSync('vscode-test', { stdio: 'inherit' });
        } catch (error) {
            console.error('❌ VS Code tests failed:', error.message);
            process.exit(1);
        }
    }
}

runVSCodeTests();