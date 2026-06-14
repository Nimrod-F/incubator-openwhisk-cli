# Schema File Location and Usage Guide

## Quick Answer

**Recommended location:** Put `action-schema.json` in the **same directory as your DAG files**.

```
actions/dag/
├── action-schema.json    ← HERE
├── my-workflow.dag
└── other-workflow.dag
```

The compiler will **auto-discover** it!

---

## Auto-Discovery Locations

The compiler searches for `action-schema.json` in this order:

1. **Same directory as the DAG file** (highest priority)

   ```
   actions/dag/action-schema.json
   ```

2. **actions/dag directory**

   ```
   actions/dag/action-schema.json
   ```

3. **actions directory**

   ```
   actions/action-schema.json
   ```

4. **Current directory**
   ```
   ./action-schema.json
   ```

---

## Usage Examples

### Example 1: Auto-Discovery (Recommended)

**Directory Structure:**

```
incubator-openwhisk-cli/
├── actions/
│   └── dag/
│       ├── action-schema.json    ← Schema file
│       └── my-workflow.dag       ← DAG file
└── wsk
```

**Command:**

```bash
# Schema is auto-discovered!
wsk dag deploy actions/dag/my-workflow.dag --name myWorkflow

# Or compile
wsk dag compile actions/dag/my-workflow.dag -o workflow.json
```

**Output:**

```
Using schema file: actions/dag/action-schema.json
✓ Type checking passed
✓ All 2 referenced action(s) validated successfully
ok: created action myWorkflow
```

---

### Example 2: Explicit Schema Path

**Directory Structure:**

```
incubator-openwhisk-cli/
├── schemas/
│   └── my-schemas.json    ← Custom location
├── actions/
│   └── dag/
│       └── my-workflow.dag
└── wsk
```

**Command:**

```bash
# Specify schema explicitly
wsk dag deploy actions/dag/my-workflow.dag \
  --name myWorkflow \
  --schemas schemas/my-schemas.json
```

---

### Example 3: No Schema File

**Directory Structure:**

```
incubator-openwhisk-cli/
├── actions/
│   └── dag/
│       └── my-workflow.dag    ← No schema file
└── wsk
```

**Command:**

```bash
wsk dag deploy actions/dag/my-workflow.dag --name myWorkflow --verbose
```

**Output:**

```
No schema file found (type checking disabled)
Validating referenced actions...
  Checking /_/hello... OK
✓ All 1 referenced action(s) validated successfully
ok: created action myWorkflow
```

---

## Schema File Format

**File: `action-schema.json`**

```json
{
  "/_/hello": {
    "parameters": {
      "name": {
        "type": "string",
        "required": true,
        "description": "The person's name"
      }
    },
    "returns": {
      "type": "string",
      "description": "A greeting message"
    }
  },
  "/_/world": {
    "parameters": {
      "msg": {
        "type": "string",
        "required": true
      }
    },
    "returns": {
      "type": "string"
    }
  },
  "/_/sendEmail": {
    "parameters": {
      "to": {
        "type": "string",
        "required": true
      },
      "subject": {
        "type": "string",
        "required": true
      },
      "body": {
        "type": "string",
        "required": false
      }
    },
    "returns": {
      "type": "object"
    }
  }
}
```

---

## CLI Flags

### `--schemas` / `-s`

Specify explicit path to schema file.

**Usage:**

```bash
# Short form
wsk dag compile my-workflow.dag -s path/to/schemas.json

# Long form
wsk dag deploy my-workflow.dag --name myWorkflow --schemas path/to/schemas.json
```

**Behavior:**

- If specified and file exists → Use it
- If specified and file doesn't exist → **Error**
- If not specified → Auto-discover

---

## Recommended Workflow

### Setup 1: Single Project

```
my-project/
├── action-schema.json         ← Project schema
├── actions/
│   ├── hello.js
│   ├── world.js
│   └── sendEmail.js
└── workflows/
    ├── workflow1.dag
    └── workflow2.dag
```

**Deploy:**

```bash
wsk dag deploy workflows/workflow1.dag --name workflow1 --schemas action-schema.json
```

---

### Setup 2: Multiple Projects

```
my-projects/
├── common-schemas.json        ← Shared schemas
├── project1/
│   ├── workflows/
│   │   └── workflow.dag
│   └── action-schema.json     ← Project-specific schemas
└── project2/
    ├── workflows/
    │   └── workflow.dag
    └── action-schema.json
```

**Deploy:**

```bash
# Use project-specific schema
cd project1
wsk dag deploy workflows/workflow.dag --name p1workflow

# Or use common schema
wsk dag deploy workflows/workflow.dag --name p1workflow --schemas ../common-schemas.json
```

---

### Setup 3: Per-DAG Schemas (Most Flexible)

```
workflows/
├── email-workflow/
│   ├── action-schema.json     ← Email workflow schemas
│   └── email.dag
├── data-workflow/
│   ├── action-schema.json     ← Data workflow schemas
│   └── data.dag
└── auth-workflow/
    ├── action-schema.json     ← Auth workflow schemas
    └── auth.dag
```

**Deploy:**

```bash
# Each workflow auto-discovers its own schema
wsk dag deploy workflows/email-workflow/email.dag --name emailWorkflow
wsk dag deploy workflows/data-workflow/data.dag --name dataWorkflow
wsk dag deploy workflows/auth-workflow/auth.dag --name authWorkflow
```

---

## Best Practices

### ✅ DO:

1. **Place schema in same directory as DAG files** for auto-discovery
2. **Use descriptive schemas** with descriptions for parameters
3. **Keep schemas version controlled** alongside DAG files
4. **Update schemas** when actions change
5. **Use explicit paths** for shared/global schemas

### ❌ DON'T:

1. **Don't scatter schema files** in random locations
2. **Don't forget to update schemas** when adding new actions
3. **Don't use absolute paths** in commands (use relative paths)
4. **Don't duplicate schemas** across projects (use shared schemas)

---

## Troubleshooting

### Problem: "Schema file not found"

**Symptom:**

```bash
$ wsk dag deploy workflow.dag --name myWorkflow --schemas my-schema.json
Error: schema file not found: my-schema.json
```

**Solution:**

1. Check the path is correct (use `ls` to verify)
2. Use relative path from current directory
3. Or use auto-discovery by placing in standard location

---

### Problem: Schema not being used

**Symptom:**

```bash
$ wsk dag deploy workflow.dag --name myWorkflow
No schema file found (type checking disabled)
```

**Solution:**

1. Place `action-schema.json` in same directory as DAG file
2. Or specify explicitly: `--schemas path/to/schema.json`
3. Verify filename is exactly `action-schema.json` (case-sensitive on Linux)

---

### Problem: Wrong schema being used

**Symptom:**
Type checking uses wrong types or missing actions

**Solution:**

```bash
# Use verbose mode to see which schema is being used
wsk dag deploy workflow.dag --name myWorkflow --verbose

# Output will show:
# Using schema file: actions/dag/action-schema.json
```

Check if that's the schema you expected. If not, use explicit path:

```bash
wsk dag deploy workflow.dag --name myWorkflow --schemas correct-schema.json
```

---

## Complete Example

### Step 1: Create Schema File

**File: `actions/dag/action-schema.json`**

```json
{
  "/_/hello": {
    "parameters": {
      "name": { "type": "string", "required": true }
    },
    "returns": { "type": "string" }
  }
}
```

### Step 2: Create DAG File

**File: `actions/dag/greeting-workflow.dag`**

```dagular
#strict

let userName: string = input["name"]
greeting = hello(name: userName)
return greeting
```

### Step 3: Deploy

```bash
# Auto-discovers schema in same directory
$ wsk dag deploy actions/dag/greeting-workflow.dag --name greetingWorkflow --verbose

Using schema file: actions/dag/action-schema.json
Validating referenced actions...
  Checking /_/hello... OK
✓ All 1 referenced action(s) validated successfully
✓ Type checking passed
ok: created action greetingWorkflow
```

### Step 4: Test

```bash
$ wsk action invoke greetingWorkflow -p name "Alice" -r
{
  "greeting": "Hello, Alice!"
}
```

---

## Summary

**Where to put `action-schema.json`:**

| Location            | Priority         | Use Case                           |
| ------------------- | ---------------- | ---------------------------------- |
| **Same dir as DAG** | ⭐⭐⭐ (Highest) | Per-workflow schemas (recommended) |
| **actions/dag/**    | ⭐⭐             | Shared across all DAGs             |
| **actions/**        | ⭐               | Project-wide schemas               |
| **Custom path**     | Manual           | Shared across projects             |

**How it's discovered:**

1. Check explicit `--schemas` flag
2. Auto-discover from standard locations
3. If not found, proceed without type checking

**Commands:**

```bash
# Auto-discovery (recommended)
wsk dag deploy workflow.dag --name myWorkflow

# Explicit schema
wsk dag deploy workflow.dag --name myWorkflow --schemas path/to/schema.json

# Check which schema is used
wsk dag deploy workflow.dag --name myWorkflow --verbose
```

**That's it! The compiler now knows where to find your schemas! 🎉**
