$root = (Get-Location).Path
$ENV:CODE_TESTS_PATH = Join-Path $root "dist/client/out/test"
$ENV:CODE_TESTS_WORKSPACE = Join-Path $root "test/fixtures"

node (Join-Path $ENV:CODE_TESTS_PATH "runTest.js")
