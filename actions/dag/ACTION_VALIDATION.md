# Action Validation in DAG Deployment

## Overview

The Dagular CLI now validates that all actions referenced in a DAG file are deployed **before** compilation or deployment. This prevents runtime errors and provides early feedback.

## How It Works

### 1. **Extraction Phase**

The system scans your `.dag` source code for action invocations:

```dagular
greeting = hello(name: "Alice")        // Detects: /_/hello
message = world(msg: greeting)         // Detects: /_/world
result = sendEmail(to: "test@...")     // Detects: /_/sendEmail
```

**Detection Pattern:** `/(actionPath)(...)`

### 2. **Validation Phase**

For each detected action, the system:

1. Parses the action path (e.g., `/_/hello`)
2. Queries OpenWhisk: `wsk action get hello`
3. Records result: ✓ exists or ✗ not found

### 3. **Decision Phase**

- **All actions exist** → Proceed with compilation/deployment ✓
- **Some actions missing** → Abort with error message ✗

---

## Usage

### **Deploy with Validation (Default)**

```bash
wsk dag deploy my-workflow.dag --name myWorkflow
```

**Output if actions exist:**

```
✓ All 3 referenced action(s) validated successfully
ok: created action myWorkflow
```

**Output if actions missing:**

```
❌ Validation failed: Some referenced actions are not deployed

Missing actions:
  • /_/hello
  • /_/sendEmail

Please deploy the missing actions first:
  wsk action create hello hello.js
  wsk action create sendEmail sendEmail.js

Or skip validation with: --skip-validation (not recommended)
```

### **Deploy with Verbose Validation**

```bash
wsk dag deploy my-workflow.dag --name myWorkflow --verbose
```

**Output:**

```
Validating referenced actions...
Found 3 action invocation(s) to validate
  Checking /_/hello... OK
  Checking /_/world... OK
  Checking /_/sendEmail... OK
✓ All 3 referenced action(s) validated successfully
ok: created action myWorkflow
```

### **Skip Validation (Not Recommended)**

```bash
wsk dag deploy my-workflow.dag --name myWorkflow --skip-validation
```

**When to use:**

- Testing/development environments
- Actions will be deployed later
- You know the actions exist but validation fails for other reasons

**Warning:** Skipping validation may result in runtime errors!

---

## Examples

### Example 1: Successful Validation

**File: `email-workflow.dag`**

```dagular
// References three actions
user = current_user()
greeting = hello(name: user.name)
result = sendEmail(
    to: user.email,
    subject: greeting,
    body: "Welcome!"
)
return result
```

**Validation Process:**

```bash
$ wsk dag deploy email-workflow.dag --name emailWorkflow --verbose

Validating referenced actions...
Found 3 action invocation(s) to validate
  Checking /_/current_user... OK
  Checking /_/hello... OK
  Checking /_/sendEmail... OK
✓ All 3 referenced action(s) validated successfully
ok: created action emailWorkflow
```

### Example 2: Missing Actions Detected

**File: `complex-workflow.dag`**

```dagular
// One action doesn't exist
data = fetchData(id: "123")        // ❌ Not deployed
processed = processData(data: data) // ✓ Exists
result = saveData(data: processed)  // ✓ Exists
return result
```

**Validation Process:**

```bash
$ wsk dag deploy complex-workflow.dag --name complexWorkflow

Validating referenced actions...

❌ Validation failed: Some referenced actions are not deployed

Missing actions:
  • /_/fetchData

Please deploy the missing actions first:
  wsk action create fetchData fetchData.js

Or skip validation with: --skip-validation (not recommended)

Error: deployment aborted due to missing actions
```

**Fix the issue:**

```bash
# Deploy the missing action
$ wsk action create fetchData fetchData.js
ok: created action fetchData

# Now deploy the DAG
$ wsk dag deploy complex-workflow.dag --name complexWorkflow
✓ All 3 referenced action(s) validated successfully
ok: created action complexWorkflow
```

### Example 3: Validation During Compilation

You can also validate without deploying:

```bash
$ wsk dag compile my-workflow.dag --validate-actions --output workflow.json
```

---

## Advanced Features

### 1. **Namespaced Actions**

```dagular
// Validates across namespaces
user = /mynamespace/userService(id: "123")
data = /_/dataService(userId: user.id)
```

### 2. **Packaged Actions**

```dagular
// Validates package/action paths
result = /mypackage/myaction(param: "value")
```

### 3. **Parallel Action Detection**

```dagular
// Detects all parallel invocations
process1(data: input)
process2(data: input)
process3(data: input)
// Validates all three actions
```

---

## Implementation Details

### Action Path Extraction

**Regex Pattern:** `/([\w_\-/]+)\s*\(`

**Matches:**

- `/_/hello(`
- `/namespace/action(`
- `/package/action(`
- `/namespace/package/action(`

**Examples:**

```dagular
hello(name: "test")          → /_/hello
/_/world(msg: "test")        → /_/world
/myns/action(x: 1)           → /myns/action
/pkg/action(x: 1)            → /pkg/action
```

### Validation Algorithm

```
1. Extract all action invocations from source
2. Deduplicate action paths (Set)
3. For each unique action:
   a. Parse action path components
   b. Query OpenWhisk API: Client.Actions.Get(actionName)
   c. Handle result:
      - Success → Mark as validated
      - 404 Error → Mark as missing
      - Other Error → Report error
4. Aggregate results
5. Decision:
   - All validated → Continue
   - Any missing → Abort with error
```

### Error Handling

**Validation Errors vs. Deployment Errors:**

| Type                  | Description                | Action                              |
| --------------------- | -------------------------- | ----------------------------------- |
| **Missing Action**    | Action not found (404)     | Abort deployment, show instructions |
| **Permission Error**  | User can't access action   | Abort, suggest checking permissions |
| **Network Error**     | Can't connect to OpenWhisk | Abort, suggest checking connection  |
| **Compilation Error** | Invalid DAG syntax         | Abort, show syntax error            |

---

## CLI Flags

### `wsk dag deploy`

| Flag                | Type   | Default  | Description                              |
| ------------------- | ------ | -------- | ---------------------------------------- |
| `--skip-validation` | bool   | false    | Skip action validation (not recommended) |
| `--verbose`         | bool   | false    | Show detailed validation progress        |
| `-n, --name`        | string | required | Name for the deployed action             |

### `wsk dag compile`

| Flag                 | Type   | Default | Description                         |
| -------------------- | ------ | ------- | ----------------------------------- |
| `--validate-actions` | bool   | false   | Validate actions during compilation |
| `-o, --output`       | string | stdout  | Output file for compiled JSON       |

---

## Best Practices

### ✅ DO:

1. **Always validate before deployment** (default behavior)
2. **Use verbose mode** when debugging: `--verbose`
3. **Deploy dependencies first** before DAG workflows
4. **Check validation errors** and follow suggestions

### ❌ DON'T:

1. **Don't skip validation** unless absolutely necessary
2. **Don't deploy DAGs** before their dependencies
3. **Don't ignore warnings** about missing actions

---

## Troubleshooting

### Problem: Validation Fails but Action Exists

**Symptom:**

```
❌ Validation failed
Missing actions:
  • /_/myaction
```

**But the action exists:**

```bash
$ wsk action list
/myns/myaction   private nodejs:14
```

**Solution:**
Check the action path format in your DAG:

```dagular
// Wrong - looking in default namespace
result = myaction(...)

// Correct - specify full path
result = /myns/myaction(...)
```

### Problem: Permission Error During Validation

**Symptom:**

```
Error: validation error: /_/action: permission denied
```

**Solution:**

1. Check you're authenticated: `wsk property get`
2. Verify you have access to the action
3. Try getting the action manually: `wsk action get actionName`

### Problem: Too Slow with Many Actions

**Symptom:**
Validation takes a long time with many referenced actions

**Solution:**
Currently validates sequentially. Future optimization: parallel validation.

---

## Future Enhancements

- [ ] **Caching**: Cache validation results for faster subsequent deploys
- [ ] **Parallel Validation**: Check multiple actions simultaneously
- [ ] **Schema Integration**: Combine with type checking for full validation
- [ ] **Dry-run Mode**: `--dry-run` to show what would be validated
- [ ] **Auto-deployment**: Offer to deploy missing actions automatically
- [ ] **Dependency Graph**: Show visual dependency tree

---

## Comparison with Other Platforms

| Platform                    | Pre-Deployment Validation                 |
| --------------------------- | ----------------------------------------- |
| **AWS Step Functions**      | ❌ No - fails at runtime                  |
| **Azure Durable Functions** | ❌ No - fails at runtime                  |
| **Google Cloud Workflows**  | ❌ No - fails at runtime                  |
| **Dagular**                 | ✅ **Yes - validates before deployment!** |

---

## Summary

**Action validation in Dagular provides:**

1. ✅ **Early error detection** - Catch missing actions before deployment
2. ✅ **Better developer experience** - Clear error messages with fix suggestions
3. ✅ **Safer deployments** - Prevent runtime errors from missing dependencies
4. ✅ **Better than competitors** - AWS, Azure, and GCP don't do this!

**Your workflows are more reliable because broken deployments are prevented upfront!** 🎉
