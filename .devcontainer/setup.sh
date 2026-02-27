#!/bin/bash
set -euo pipefail

SETUP_SUCCESS_MARKER="/workspaces/VBA-LanguageServer/.codespace-setup-success"
rm -f "$SETUP_SUCCESS_MARKER"

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
    xvfb \
    x11-utils \
    xauth

# Set up virtual display for headless testing if not already set
echo "Setting up virtual display for headless testing..."
if [ -z "${DISPLAY:-}" ]; then
    export DISPLAY=:99
    # Start Xvfb if not already running
    if ! pgrep -x "Xvfb" > /dev/null; then
        echo "Starting Xvfb for headless testing..."
        Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
        XVFB_PID=$!
        sleep 3

        # Verify Xvfb started successfully
        if ! kill -0 "$XVFB_PID" 2>/dev/null; then
            echo "Failed to start Xvfb"
            exit 1
        fi
        echo "Xvfb started with PID $XVFB_PID on display :99"
    fi
fi

# Verify display is available
if ! xdpyinfo -display :99 >/dev/null 2>&1; then
    echo "Display :99 is not available, trying xvfb-run approach..."
    exec xvfb-run -a node "$(pwd)/dist/client/out/test/runTest"
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
npm run build

touch "$SETUP_SUCCESS_MARKER"

echo "Setup complete!"
echo "Running with DISPLAY=$DISPLAY"
echo "You can now run 'npm run testsh' to execute e2e tests in the headless environment."

# Logs: /workspaces/.codespaces/.persistedshare/creation.log