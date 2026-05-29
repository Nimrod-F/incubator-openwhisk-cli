# OpenWhisk CLI - Copy-Paste Commands

## Add to PATH (One Command)

**Copy and paste this entire line into your terminal:**

```bash
echo 'export PATH="/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Then test it:
```bash
wsk list
```

---

## Common Commands (Ready to Use)

After adding to PATH, you can use these directly:

### View & Manage Configuration
```bash
# See all settings
wsk property get --all

# Set API host
wsk property set --apihost http://localhost:3233

# Set authentication
wsk property set --auth YOUR_AUTH_TOKEN_HERE

# Set namespace
wsk property set --namespace YOUR_NAMESPACE
```

### List Everything
```bash
# List all entities
wsk list

# List only actions
wsk action list

# List only triggers
wsk trigger list

# List only rules
wsk rule list

# List only packages
wsk package list

# List recent activations
wsk activation list
```

### Work with Actions
```bash
# Create action from file
wsk action create myaction myfile.js

# Get action details
wsk action get myaction

# Invoke action
wsk action invoke myaction

# Invoke and show result
wsk action invoke myaction --result

# Invoke with parameters
wsk action invoke myaction --param key value --result

# Update action
wsk action update myaction myfile.js

# Delete action
wsk action delete myaction

# List all actions
wsk action list
```

### Work with Activations (Logs/History)
```bash
# List activations
wsk activation list

# Get activation details
wsk activation get ACTIVATION_ID

# View activation result
wsk activation result ACTIVATION_ID

# View activation logs
wsk activation logs ACTIVATION_ID
```

### Work with Triggers
```bash
# Create trigger
wsk trigger create myTrigger

# Fire trigger
wsk trigger fire myTrigger

# Fire trigger with parameters
wsk trigger fire myTrigger --param key value

# List triggers
wsk trigger list

# Delete trigger
wsk trigger delete myTrigger
```

### Work with Rules
```bash
# Create rule (connects trigger to action)
wsk rule create myRule myTrigger myaction

# Enable rule
wsk rule enable myRule

# Disable rule
wsk rule disable myRule

# List rules
wsk rule list

# Delete rule
wsk rule delete myRule
```

### Work with Packages
```bash
# Create package
wsk package create mypackage

# List packages
wsk package list

# Get package details
wsk package get mypackage

# Delete package
wsk package delete mypackage
```

---

## Complete Example Workflow

Copy and paste each section one at a time:

### Step 1: Setup (Run once)
```bash
echo 'export PATH="/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

### Step 2: Verify Connection
```bash
wsk property get --all
wsk list
```

### Step 3: Create Your First Action
```bash
wsk action create hello actions/hello.js
```

### Step 4: List Actions
```bash
wsk action list
```

### Step 5: Get Action Details
```bash
wsk action get hello
```

### Step 6: Invoke the Action
```bash
wsk action invoke hello --result
```

### Step 7: Create a Trigger
```bash
wsk trigger create helloTrigger
```

### Step 8: Create a Rule
```bash
wsk rule create helloRule helloTrigger hello
```

### Step 9: Fire the Trigger (this will invoke the action)
```bash
wsk trigger fire helloTrigger
```

### Step 10: Check Activations
```bash
wsk activation list
```

### Step 11: View Activation Details
```bash
# Replace ACTIVATION_ID with an actual ID from the list
wsk activation logs ACTIVATION_ID
wsk activation result ACTIVATION_ID
```

---

## Debugging & Help

### Help for any command
```bash
# General help
wsk --help

# Help for a specific command
wsk action --help
wsk trigger --help
wsk rule --help

# Verbose output (for debugging)
wsk list -v

# Debug mode (detailed output)
wsk list -d
```

### Check Configuration
```bash
# View all properties
wsk property get --all

# View specific property
wsk property get --apihost
wsk property get --auth
wsk property get --namespace
```

---

## Practical Examples

### Example 1: Create and Test an Action
```bash
# Create a simple hello action
wsk action create hello actions/hello.js

# Invoke it
wsk action invoke hello --result

# Check logs
wsk activation list
wsk activation logs ACTIVATION_ID_HERE
```

### Example 2: Setup Automation with Trigger and Rule
```bash
# Create trigger
wsk trigger create processData

# Create rule (connects trigger to action)
wsk rule create processRule processData hello

# Fire trigger
wsk trigger fire processData

# Check what happened
wsk activation list
```

### Example 3: Create Action with Parameters
```bash
# Invoke with parameters
wsk action invoke hello --param name "Alice" --result

# The action receives:
# {
#   "name": "Alice"
# }
```

### Example 4: Update Configuration
```bash
# If you change your OpenWhisk server:
wsk property set --apihost http://new-server:3233

# If you change authentication:
wsk property set --auth NEW_AUTH_TOKEN

# Verify changes
wsk property get --all
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Setup PATH | `echo 'export PATH="..." >> ~/.zshrc && source ~/.zshrc` |
| Check config | `wsk property get --all` |
| Test connection | `wsk list` |
| Create action | `wsk action create NAME FILE.js` |
| Run action | `wsk action invoke NAME --result` |
| View logs | `wsk activation logs ID` |
| Create trigger | `wsk trigger create NAME` |
| Fire trigger | `wsk trigger fire NAME` |
| Create rule | `wsk rule create RULE_NAME TRIGGER ACTION` |
| List actions | `wsk action list` |
| Get help | `wsk --help` or `wsk COMMAND --help` |

---

## Troubleshooting One-Liners

### "command not found: wsk"
Run this to add to PATH:
```bash
echo 'export PATH="/Users/arisoniga/IdeaProjects/incubator-openwhisk-cli:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

### "Unable to obtain API build information"
Your OpenWhisk instance isn't running. Check its status and start it.

### Test if OpenWhisk is running
```bash
curl -X GET http://localhost:3233/api/v1
```

### Reconfigure API host
```bash
wsk property set --apihost http://localhost:3233
```

### Reconfigure authentication
```bash
wsk property set --auth 23bc46b1-71f6-4ed5-8c54-816aa4f8c502:123zO3xZCLrMN6v2BKK1dXYFpXlPkccOFqm12CdAsMgRU4VrNZ9lyGVCGuMDGIwP
```

---

## Pro Tips

1. **Alias for shorter typing:**
   ```bash
   alias w=wsk
   w list  # Instead of wsk list
   ```

2. **Save output to file:**
   ```bash
   wsk action list > actions.txt
   wsk activation logs ID > logs.txt
   ```

3. **Use jq for JSON parsing (if installed):**
   ```bash
   wsk activation list | head -1
   # or
   wsk action invoke hello --result | jq '.greeting'
   ```

4. **Quickly check OpenWhisk status:**
   ```bash
   wsk list && echo "✅ OpenWhisk is running"
   ```

5. **View all your recent activity:**
   ```bash
   wsk activation list | head -20
   ```

---

## Your Next Steps

1. ✅ Run `wsk list` to confirm everything works
2. 📝 Create your first action: `wsk action create myaction code.js`
3. ▶️ Invoke it: `wsk action invoke myaction --result`
4. 🔍 Check logs: `wsk activation list` → `wsk activation logs ID`
5. 🎯 Read the full guides: QUICK_START.md, SETUP_GUIDE.md, STATUS_REPORT.md

**You're all set!** 🚀


