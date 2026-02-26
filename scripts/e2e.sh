#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"
TEST_ENTRYPOINT="$ROOT_DIR/dist/client/out/test/runTest.js"

echo "Building project before e2e tests..."
npm run build

export CODE_TESTS_PATH="$ROOT_DIR/dist/client/out/test"
export CODE_TESTS_WORKSPACE="$ROOT_DIR/test/fixtures"

node "$TEST_ENTRYPOINT"