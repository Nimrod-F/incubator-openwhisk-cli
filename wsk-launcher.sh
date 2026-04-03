#!/bin/bash

# OpenWhisk CLI Easy Launcher
# This script makes it easy to run the wsk CLI from anywhere

PROJECT_DIR="/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli"

# Check if the binary exists
if [ ! -f "$PROJECT_DIR/wsk" ]; then
    echo "Error: wsk binary not found at $PROJECT_DIR/wsk"
    echo "Please build it first with: cd $PROJECT_DIR && go build -o wsk"
    exit 1
fi

# Execute wsk with all arguments passed through
"$PROJECT_DIR/wsk" "$@"

