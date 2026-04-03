#!/bin/bash

LOGFILE="/tmp/openwhisk_cli_test.log"
> "$LOGFILE"  # Clear the log file

{
    echo "========================================"
    echo "OpenWhisk CLI Full Test Suite"
    echo "========================================"
    echo "Start time: $(date)"
    echo ""

    echo "1. Checking port 3232 connectivity..."
    if (echo > /dev/tcp/localhost/3232) 2>/dev/null; then
        echo "✓ Port 3232 is OPEN"
    else
        echo "✗ Port 3232 is CLOSED - OpenWhisk may not be running"
    fi
    echo ""

    echo "2. Current directory:"
    pwd
    echo ""

    echo "3. wsk binary location and info:"
    ls -lh ./wsk
    file ./wsk
    echo ""

    echo "4. Checking current configuration (~/.wskprops):"
    if [ -f ~/.wskprops ]; then
        cat ~/.wskprops
    else
        echo "~/.wskprops not found"
    fi
    echo ""

    echo "5. Running: ./wsk property get"
    ./wsk property get 2>&1
    echo ""

    echo "6. Running: ./wsk action list"
    ./wsk action list 2>&1
    echo ""

    echo "7. Running: ./wsk activation list"
    ./wsk activation list 2>&1
    echo ""

    echo "End time: $(date)"
    echo "========================================"

} >> "$LOGFILE" 2>&1

echo "Test results written to: $LOGFILE"
cat "$LOGFILE"

