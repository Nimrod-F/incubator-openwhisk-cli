# Complete Guide: Type Checking + Action Validation in Dagular

## Overview

Your Dagular system now has **TWO powerful validation layers** that work together to ensure safe deployments:

1. **Type Checking** - Validates parameter types match function signatures
2. **Action Validation** - Validates all referenced actions are deployed

## The Two Validation Systems

### 🎯 **Layer 1: Type Checking**

**Question:** _"How does the system know that `hello` expects `name: string`?"_

**Answer:** Through multiple sources (priority order):

```
1. Inline declarations in DAG   (highest priority)
   ↓
2. Schema registry file (action-schema.json)
   ↓
3. Type inference from usage
   ↓
4. Unknown/Any (allow in non-strict mode)
```

**Example:**

```dagular
#strict

// Type info from action-schema.json:
// "/_/hello": { "parameters": { "name": { "type": "string" } } }

let userName: string = "Alice"
let userAge: number = 25

greeting = hello(name: userName)  // ✅ OK: string matches string
badCall = hello(name: userAge)    // ❌ ERROR: number doesn't match string
```

**Error Message:**

```
Type Error: Type mismatch for parameter 'name' in /_/hello
  Expected: string (from schema)
  Actual: number
```

---

### 🔍 **Layer 2: Action Validation**

**Question:** _"Can we detect if actions are deployed before using them?"_

**Answer:** Yes! The system validates all referenced actions exist.

**Example:**

```dagular
// DAG file references three actions
greeting = hello(name: "Bob")        // Checks if /_/hello exists
message = world(msg: greeting)       // Checks if /_/world exists
result = notDeployed(data: message)  // Checks if /_/notDeployed exists
```

**Validation Output:**

```bash
$ wsk dag deploy workflow.dag --name myWorkflow --verbose

Validating referenced actions...
Found 3 action invocation(s) to validate
  Checking /_/hello... OK
  Checking /_/world... OK
  Checking /_/notDeployed... NOT FOUND

❌ Validation failed: Some referenced actions are not deployed

Missing actions:
  • /_/notDeployed

Please deploy the missing actions first:
  wsk action create notDeployed notDeployed.js
```

---

## Complete Validation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  DAG File (my-workflow.dag)                                 │
│                                                              │
│  #strict                                                     │
│                                                              │
│  let userName: string = input["name"]                       │
│  greeting = hello(name: userName)                           │
│  result = sendEmail(to: "test@...", subject: greeting)      │
│  return result                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Action Validation                                 │
│  ─────────────────────────────────────────────────────────  │
│  Extract action invocations:                                │
│    - /_/hello                                               │
│    - /_/sendEmail                                           │
│                                                              │
│  Check if they exist in OpenWhisk:                          │
│    ✓ /_/hello → exists                                      │
│    ✓ /_/sendEmail → exists                                  │
│                                                              │
│  Result: ✅ All actions validated                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Type Checking                                     │
│  ─────────────────────────────────────────────────────────  │
│  Load schemas (action-schema.json):                         │
│    /_/hello: (name: string) => string                       │
│    /_/sendEmail: (to: string, subject: string) => object    │
│                                                              │
│  Check invocations:                                         │
│    hello(name: userName)                                    │
│      ✓ userName is string, expected string → OK            │
│                                                              │
│    sendEmail(to: "...", subject: greeting)                  │
│      ✓ to is string, expected string → OK                  │
│      ✓ subject is string (from hello), expected string → OK│
│                                                              │
│  Result: ✅ All types validated                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: Compilation                                       │
│  ─────────────────────────────────────────────────────────  │
│  Parse DAG syntax → AST                                     │
│  Optimize parallel execution                                │
│  Generate JSON representation                               │
│                                                              │
│  Result: ✅ workflow.json                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: Deployment                                        │
│  ─────────────────────────────────────────────────────────  │
│  Create OpenWhisk action                                    │
│  Kind: "dagular"                                            │
│  Code: <compiled JSON>                                      │
│                                                              │
│  Result: ✅ Action deployed successfully                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Practical Examples

### Example 1: Everything Valid ✅

**Setup:**

```bash
# Deploy required actions first
wsk action create hello hello.js
wsk action create sendEmail sendEmail.js

# Create schema file
cat > action-schema.json << EOF
{
  "/_/hello": {
    "parameters": { "name": { "type": "string", "required": true } },
    "returns": { "type": "string" }
  },
  "/_/sendEmail": {
    "parameters": {
      "to": { "type": "string", "required": true },
      "subject": { "type": "string", "required": true }
    },
    "returns": { "type": "object" }
  }
}
EOF
```

**DAG File:**

```dagular
#strict

let userName: string = input["name"]
greeting = hello(name: userName)
result = sendEmail(to: "test@example.com", subject: greeting)
return result
```

**Deploy:**

```bash
wsk dag deploy workflow.dag --name myWorkflow --verbose
```

**Output:**

```
Validating referenced actions...
Found 2 action invocation(s) to validate
  Checking /_/hello... OK
  Checking /_/sendEmail... OK
✓ All 2 referenced action(s) validated successfully
✓ Type checking passed
✓ Compiled successfully
ok: created action myWorkflow
```

---

### Example 2: Missing Action ❌

**DAG File:**

```dagular
greeting = hello(name: "Alice")
result = missingAction(data: greeting)  // Not deployed!
return result
```

**Deploy:**

```bash
wsk dag deploy workflow.dag --name myWorkflow
```

**Output:**

```
Validating referenced actions...

❌ Validation failed: Some referenced actions are not deployed

Missing actions:
  • /_/missingAction

Please deploy the missing actions first:
  wsk action create missingAction missingAction.js

Error: deployment aborted due to missing actions
```

**Fix:**

```bash
# Deploy the missing action
wsk action create missingAction missingAction.js

# Now it works
wsk dag deploy workflow.dag --name myWorkflow
✓ All 2 referenced action(s) validated successfully
ok: created action myWorkflow
```

---

### Example 3: Type Mismatch ❌

**DAG File:**

```dagular
#strict

let userAge: number = 25
greeting = hello(name: userAge)  // Type error!
return greeting
```

**Deploy:**

```bash
wsk dag deploy workflow.dag --name myWorkflow
```

**Output:**

```
Validating referenced actions...
  Checking /_/hello... OK
✓ All 1 referenced action(s) validated successfully

Type Error: Type mismatch for parameter 'name' in /_/hello
  Parameter: name
  Expected: string (from schema)
  Actual: number

Error: Type checking failed
```

**Fix:**

```dagular
#strict

let userAge: number = 25
let userName: string = "User " + toString(userAge)
greeting = hello(name: userName)  // Now correct!
return greeting
```

---

## CLI Commands Summary

### Deploy with Full Validation (Recommended)

```bash
wsk dag deploy workflow.dag --name myWorkflow --verbose
```

**What it does:**

1. ✓ Validates all actions exist
2. ✓ Checks type compatibility
3. ✓ Compiles DAG to JSON
4. ✓ Deploys to OpenWhisk

### Deploy with Relaxed Validation

```bash
# Skip action validation (not recommended)
wsk dag deploy workflow.dag --name myWorkflow --skip-validation

# Skip type checking (allow any types)
wsk dag deploy workflow.dag --name myWorkflow  # remove #strict from DAG
```

### Compile with Validation

```bash
# Compile and validate actions
wsk dag compile workflow.dag --validate-actions -o workflow.json

# Compile with type checking
wsk dag compile workflow.dag --schemas action-schema.json -o workflow.json
```

---

## Configuration Files

### 1. Schema File (`action-schema.json`)

```json
{
  "/_/hello": {
    "parameters": {
      "name": { "type": "string", "required": true }
    },
    "returns": { "type": "string" }
  },
  "/_/world": {
    "parameters": {
      "msg": { "type": "string", "required": true }
    },
    "returns": { "type": "string" }
  },
  "/_/sendEmail": {
    "parameters": {
      "to": { "type": "string", "required": true },
      "subject": { "type": "string", "required": true },
      "body": { "type": "string", "required": false }
    },
    "returns": { "type": "object" }
  }
}
```

### 2. DAG File with Inline Types

```dagular
#strict

// Inline declarations (override schema)
declare customAction: (data: object) => string

// Or use schema from action-schema.json
greeting = hello(name: "Alice")

return greeting
```

---

## Benefits Over Other Platforms

| Feature                              | AWS Step Functions  | Azure Durable       | Google Workflows    | **Dagular**                   |
| ------------------------------------ | ------------------- | ------------------- | ------------------- | ----------------------------- |
| **Pre-deployment action validation** | ❌ No               | ❌ No               | ❌ No               | ✅ **Yes**                    |
| **Type checking**                    | ❌ Runtime only     | ❌ Runtime only     | ❌ Runtime only     | ✅ **Compile-time**           |
| **Missing action detection**         | ❌ Fails at runtime | ❌ Fails at runtime | ❌ Fails at runtime | ✅ **Caught before deploy**   |
| **Type mismatch detection**          | ❌ Fails at runtime | ❌ Fails at runtime | ❌ Fails at runtime | ✅ **Caught before deploy**   |
| **Helpful error messages**           | ⚠️ Basic            | ⚠️ Basic            | ⚠️ Basic            | ✅ **Detailed + suggestions** |

---

## Best Practices

### ✅ DO:

1. **Always use validation** (default behavior)
2. **Create schema files** for your actions
3. **Use strict mode** for type safety: `#strict`
4. **Deploy dependencies first** before DAG workflows
5. **Use verbose mode** when debugging: `--verbose`
6. **Keep schemas updated** when actions change

### ❌ DON'T:

1. **Don't skip validation** unless absolutely necessary
2. **Don't deploy DAGs** before their dependencies
3. **Don't ignore type warnings**
4. **Don't use `any` types** everywhere (defeats the purpose)

---

## Troubleshooting

### Problem: "Action exists but validation says it's missing"

**Check:**

1. Action path format: `/_/actionName` vs `/namespace/actionName`
2. Authentication: `wsk property get`
3. Namespace: Are you in the correct namespace?

**Solution:**

```bash
# List all actions to see exact paths
wsk action list

# Use exact path from list in your DAG
```

### Problem: "Type checking too strict"

**Options:**

1. Remove `#strict` for relaxed mode
2. Update schema to match actual usage
3. Add explicit type annotations to clarify intent

---

## Summary

**Dagular now provides enterprise-grade validation:**

1. ✅ **Action Validation** - Ensures all dependencies exist before deployment
2. ✅ **Type Checking** - Catches type mismatches at compile time
3. ✅ **Clear Error Messages** - Tells you exactly what's wrong and how to fix it
4. ✅ **Better than AWS/Azure/Google** - They only validate at runtime!

**Result: Your workflows are safer, more reliable, and easier to debug!** 🎉

---

## Files Created

- `action_validator.js` - Action validation logic
- `type_checker.js` - Type checking logic
- `compiler_with_types.js` - Enhanced compiler with type checking
- `dag.go` - Updated CLI with validation flags
- `action-schema.json` - Schema definition file
- `ACTION_VALIDATION.md` - Action validation documentation
- `TYPE_CHECKING_EXPLAINED.md` - Type checking documentation

**Everything you need for robust DAG deployments!**
