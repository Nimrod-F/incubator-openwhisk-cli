# OpenWhisk CLI - Quick Start Guide

## TL;DR - Your CLI is Ready! ✅

Your OpenWhisk CLI is **already built and working**. It's connected to your running OpenWhisk instance.

---

## Run the CLI Right Now

From the project directory:

```bash
cd /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli
./wsk list
```

**Output:**
```
Entities in namespace: default
packages
actions
/guest/hello                                                           private nodejs:20
triggers
rules
```

---

## Make it Easy to Use Everywhere

### Option 1: Add to PATH (Recommended)

Add this to your `~/.zshrc`:
```bash
export PATH="/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli:$PATH"
```

Then reload:
```bash
source ~/.zshrc
```

Now you can just type `wsk` from anywhere:
```bash
wsk list
wsk action list
```

### Option 2: Use the launcher script

```bash
/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/wsk-launcher.sh list
```

### Option 3: Create symlink (requires sudo)

```bash
sudo ln -s /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/wsk /usr/local/bin/wsk
wsk list
```

---

## One-Liner to Add to PATH

```bash
echo 'export PATH="/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Then verify it works:
```bash
wsk --version
wsk property get --all
wsk list
```

---

## Most Useful Commands

```bash
# List everything
wsk list

# List actions
wsk action list

# Get action details
wsk action get hello

# Create an action
wsk action create myaction actions/hello.js

# Invoke an action
wsk action invoke hello --result

# View activations (execution logs)
wsk activation list

# View specific activation
wsk activation logs <activation-id>

# Create a trigger
wsk trigger create myTrigger

# Create a rule
wsk rule create myRule myTrigger hello

# Fire a trigger
wsk trigger fire myTrigger

# Get configuration
wsk property get --all

# Set configuration
wsk property set --apihost http://localhost:3233
```

---

## Your Configuration

```
API Host:   http://localhost:3233
Auth:       23bc46b1-71f6-4ed5-8c54-816aa4f8c502:***
Namespace:  guest
API Ver:    v1
```

All these are already configured. The CLI uses them automatically.

---

## Troubleshooting

### "command not found: wsk"
- Add the project directory to PATH (see above)
- Or use `./wsk` from the project directory
- Or use the full path: `/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli/wsk`

### "Unable to obtain API build information"
- Your OpenWhisk instance isn't running
- Start it: it's running as a daemon, so check its status

### "Invalid authentication"
```bash
wsk property set --auth <your-auth-token>
```

---

## Build a New Binary (if you modify code)

```bash
cd /Users/arisoniga/IdeaProjects/incubator-openwhisk-cli
go build -o wsk
```

Or cross-compile for other platforms:
```bash
./gradlew build
```

---

## Need Help?

- Full guide: `SETUP_GUIDE.md`
- Original readme: `README.md`
- Contributing guide: `CONTRIBUTING.md`

---

## Current Status Summary

| Item | Status |
|------|--------|
| Binary compiled | ✅ Yes |
| Works on your system | ✅ Yes (ARM64) |
| Connected to OpenWhisk | ✅ Yes |
| Can list entities | ✅ Yes |
| Can invoke actions | ✅ Yes |
| Can view activations | ✅ Yes |
| Ready to use | ✅ 100% |

---

**You're all set! Just run `wsk list` to start using your OpenWhisk CLI!** 🚀

