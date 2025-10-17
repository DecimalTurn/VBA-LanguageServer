#!/bin/bash
set -euo pipefail

# Run from repository root when executed as a postCreateCommand
cd "$(pwd)"

npm ci
npm i -g @vscode/vsce
npm run build:textMate
npm run antlr
npm run mvantlr

echo "Setup complete!"