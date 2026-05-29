# OpenWhisk CLI - Complete Setup Guide

## Current Status: ✅ WORKING

Your OpenWhisk CLI is fully functional and connected to your running OpenWhisk instance.

---

## Overview

This is the **Apache OpenWhisk Command-Line Interface (CLI)** - a unified tool to interact with OpenWhisk serverless functions. It's written in Go and provides a consistent interface for managing actions, activations, triggers, rules, APIs, and more.

### Key Information:
- **Language**: Go (v1.22+)
- **Binary Name**: `wsk`
- **Location**: `/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/wsk`
- **Status**: Already compiled and ready to use

---

## Project Structure

```
incubator-openwhisk-cli/
├── main.go                 # Main entry point
├── go.mod                  # Go dependencies
├── go.sum                  # Dependency checksums
├── wsk                     # Pre-compiled binary (ARM64 macOS)
├── commands/               # Core CLI command implementations
│   ├── commands.go        # Command setup and client config
│   ├── action.go          # Action management commands
│   ├── activation.go      # Activation queries
│   ├── api.go             # API management
│   ├── trigger.go         # Trigger management
│   ├── rule.go            # Rule management
│   ├── property.go        # Property/config management
│   ├── namespace.go       # Namespace management
│   ├── package.go         # Package management
│   └── wsk.go             # Root command definition
├── build.gradle            # Gradle build configuration (for multi-platform builds)
├── actions/                # Example actions and test files
│   ├── hello.js           # Example Node.js action
│   ├── adder.js           # Example adder action
│   └── dag/               # DAG (Directed Acyclic Graph) examples
├── wski18n/               # Internationalization resources
└── tests/                 # Test files
```

---

## Current Configuration

Your CLI is already configured to connect to your local OpenWhisk instance:

```
API Host:     http://localhost:3233
Auth Token:   23bc46b1-71f6-4ed5-8c54-816aa4f8c502:123zO3xZCLrMN6v2BKK1dXYFpXlPkccOFqm12CdAsMgRU4VrNZ9lyGVCGuMDGIwP
Namespace:    guest
API Version:  v1
```

These values are stored in your `~/.wskprops` file (or wherever the CLI stores them).

---

## Essential Commands

### List all entities
```bash
./wsk list
```

### Work with actions
```bash
# List all actions
./wsk action list

# Get action details
./wsk action get <action-name>

# Create a new action
./wsk action create <action-name> <file.js>

# Invoke an action
./wsk action invoke <action-name> --result
```

### Work with activations (execution logs)
```bash
# List activations
./wsk activation list

# Get activation details
./wsk activation get <activation-id>

# Get activation result
./wsk activation result <activation-id>

# Get activation logs
./wsk activation logs <activation-id>
```

### Work with triggers
```bash
# Create a trigger
./wsk trigger create <trigger-name>

# Fire a trigger
./wsk trigger fire <trigger-name> -p key value

# List triggers
./wsk trigger list
```

### Work with rules
```bash
# Create a rule connecting trigger to action
./wsk rule create <rule-name> <trigger-name> <action-name>

# List rules
./wsk rule list
```

### View and modify properties
```bash
# Get all properties
./wsk property get --all

# Get specific property
./wsk property get --apihost

# Set API host
./wsk property set --apihost http://localhost:3233

# Set authentication
./wsk property set --auth <auth-token>
```

---

## Building the CLI from Source

### Option 1: Build with Go (Simple, faster)

```bash
cd /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli
go build -o wsk
```

This creates a `wsk` binary for your current platform (macOS ARM64 in your case).

### Option 2: Build with Gradle (Cross-platform)

For building binaries for multiple platforms:

```bash
cd /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli
./gradlew build
```

This will create binaries for all supported platforms in `build/` directory:
- `darwin-amd64/` (macOS Intel)
- `linux-amd64/` (Linux 64-bit)
- `linux-386/` (Linux 32-bit)
- `windows-amd64/` (Windows 64-bit)
- And others (ARM, PowerPC, etc.)

### Option 3: Build for specific OS/Architecture

```bash
# For example, build for Linux 64-bit
GOOS=linux GOARCH=amd64 go build -o wsk-linux-amd64
```

---

## Rebuilding the Current Binary (if needed)

If you want to rebuild the current `wsk` binary after making changes:

```bash
cd /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli

# First, ensure dependencies are up to date
go get -d -t ./...

# Then rebuild
go build -o wsk
```

---

## Easy CLI Access (System-wide)

To use `wsk` from anywhere on your system without the `./` prefix:

### Option 1: Add to PATH
```bash
# Add this line to your ~/.zshrc
export PATH="/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli:$PATH"

# Then reload your shell
source ~/.zshrc

# Now you can use wsk directly
wsk list
```

### Option 2: Create a symlink
```bash
sudo ln -s /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/wsk /usr/local/bin/wsk

# Then use it directly
wsk list
```

### Option 3: Create an alias (temporary, for current session)
```bash
alias wsk='/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/wsk'

# Now you can use wsk directly
wsk list
```

---

## Understanding the Configuration Values

### Whisk API Host
This is the endpoint of your OpenWhisk server. Since you're running OpenWhisk locally:
- **http://localhost:3233** - Your local OpenWhisk server

### Whisk Auth (Authentication)
This is a two-part authentication token:
- **Part 1** (before colon): Username/Namespace ID
- **Part 2** (after colon): Password/Auth Key

Example: `23bc46b1-71f6-4ed5-8c54-816aa4f8c502:123zO3xZCLrMN6v2BKK1dXYFpXlPkccOFqm12CdAsMgRU4VrNZ9lyGVCGuMDGIwP`

These are stored and used automatically by the CLI for authentication.

---

## Testing Your Setup

Run these commands to verify everything is working:

```bash
# 1. Check CLI version and help
./wsk --help

# 2. Check current configuration
./wsk property get --all

# 3. Test connection to OpenWhisk
./wsk list

# 4. Test creating an action
./wsk action create hello actions/hello.js

# 5. Test invoking an action
./wsk action invoke hello --result

# 6. Test listing your action
./wsk action list
```

---

## Troubleshooting

### Error: "Unable to obtain API build information: dial tcp..."
**Cause**: OpenWhisk server is not running
**Solution**: Start your OpenWhisk instance (you mentioned it's running as a daemon)

### Error: "Invalid API host"
**Cause**: API host is not set correctly
**Solution**: 
```bash
./wsk property set --apihost http://localhost:3233
```

### Error: "Invalid authentication"
**Cause**: Auth token is incorrect or expired
**Solution**: 
```bash
./wsk property set --auth <your-correct-auth-token>
```

### Permission denied on wsk binary
**Solution**: 
```bash
chmod +x ./wsk
```

---

## Example Workflow

Here's a complete workflow to get started:

```bash
# 1. Change to project directory
cd /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli

# 2. Verify connection
./wsk list

# 3. Create your first action from existing example
./wsk action create myaction actions/hello.js

# 4. List actions to verify creation
./wsk action list

# 5. Invoke the action
./wsk action invoke myaction --result

# 6. Check activation logs
./wsk activation list
./wsk activation logs <activation-id-from-list>

# 7. Create a trigger
./wsk trigger create myTrigger

# 8. Create a rule connecting trigger to action
./wsk rule create myRule myTrigger myaction

# 9. Fire the trigger to test the rule
./wsk trigger fire myTrigger

# 10. Check activations again
./wsk activation list
```

---

## Project Dependencies

Key Go dependencies your CLI uses:
- **openwhisk-client-go**: Official Go client library for OpenWhisk
- **cobra**: CLI framework
- **go-i18n**: Internationalization support
- **yaml**: Configuration file parsing

All dependencies are listed in `go.mod` and automatically managed by Go.

---

## Documentation

For more detailed information:
1. **README.md** - General project information and build instructions
2. **CONTRIBUTING.md** - Development setup and guidelines
3. **CHANGELOG.md** - Version history and changes
4. **Official OpenWhisk Docs**: https://github.com/apache/openwhisk

---

## Next Steps

You can now:
1. ✅ Use the CLI to manage your running OpenWhisk instance
2. 📝 Create new actions from your files
3. 🔄 Set up triggers and rules for automation
4. 📊 Monitor activations and logs
5. 🚀 Deploy serverless functions

Your OpenWhisk CLI is **fully operational** and ready to use! 🎉


