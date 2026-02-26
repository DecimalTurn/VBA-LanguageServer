#!/bin/bash
set -euo pipefail

# Run from repository root when executed as a postCreateCommand
cd "$(pwd)"

# Install system dependencies required for VS Code tests
echo "Installing system dependencies for VS Code testing..."
sudo apt update
sudo apt install -y \
    libnspr4 \
    libnss3 \
    libxss1 \
    libasound2t64 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libdbus-1-3 \
    libgtk-3-0t64 \
    libglib2.0-0t64 \
    libatspi2.0-0t64 \
    xvfb

# Start Xvfb for headless testing (if not already running)
echo "Setting up virtual display for headless testing..."
export DISPLAY=:99
if ! pgrep -x "Xvfb" > /dev/null; then
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
    echo "Started Xvfb on display :99"
else
    echo "Xvfb already running"
fi

# Add DISPLAY environment variable to .bashrc for future sessions
if ! grep -q "export DISPLAY=:99" ~/.bashrc; then
    echo "export DISPLAY=:99" >> ~/.bashrc
    echo "Added DISPLAY=:99 to .bashrc"
fi

npm ci
npm i -g @vscode/vsce
npm run build:textMate
npm run antlr
# For some reason, antlr4ng writes to a different location on the VM
# than it does locally, preventing compile. Command added to move the generated files.
mv ./server/src/antlr/out/server/src/antlr/* ./server/src/antlr/out

echo "Setup complete!"
echo "You can now run 'npm run testsh' to execute e2e tests in the headless environment."

# Logs: /workspaces/.codespaces/.persistedshare/creation.log