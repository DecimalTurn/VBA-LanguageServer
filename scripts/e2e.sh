#!/usr/bin/env bash

# Set up virtual display for headless testing if not already set
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:99
    # Start Xvfb if not already running
    if ! pgrep -x "Xvfb" > /dev/null; then
        echo "Starting Xvfb for headless testing..."
        Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
        sleep 2  # Give Xvfb a moment to start
    fi
fi

export CODE_TESTS_PATH="$(pwd)/dist/client/out/test"
export CODE_TESTS_WORKSPACE="$(pwd)/test/fixtures"

node "$(pwd)/dist/client/out/test/runTest"