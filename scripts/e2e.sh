#!/usr/bin/env bash

# Set up virtual display for headless testing if not already set
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:99
    # Start Xvfb if not already running
    if ! pgrep -x "Xvfb" > /dev/null; then
        echo "Starting Xvfb for headless testing..."
        Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
        XVFB_PID=$!
        sleep 3  # Give Xvfb more time to start
        
        # Verify Xvfb started successfully
        if ! kill -0 $XVFB_PID 2>/dev/null; then
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

export CODE_TESTS_PATH="$(pwd)/dist/client/out/test"
export CODE_TESTS_WORKSPACE="$(pwd)/test/fixtures"

echo "Running tests with DISPLAY=$DISPLAY"
node "$(pwd)/dist/client/out/test/runTest"