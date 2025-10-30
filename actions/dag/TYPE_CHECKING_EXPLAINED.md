# How Type Checking Knows Function Signatures in Option 5

## Your Question

> "In option 5, how can the system know that `hello` function expects a `string` as parameter for `name`?"

## The Answer: Multiple Information Sources

The type checker can discover that `hello(name: string)` through **multiple sources**, prioritized in this order:

---

## 📋 **Source 1: Schema Registry (action-schema.json)** ⭐ RECOMMENDED

**Location:** `actions/dag/action-schema.json`

```json
{
  "/_/hello": {
    "parameters": {
      "name": {
        "type": "string",
        "required": true
      }
    },
    "returns": {
      "type": "string"
    }
  }
}
```

**How it works:**

1. Developer creates schema file with all action signatures
2. Compiler loads schemas at compile time
3. When encountering `hello(name: age)`, compiler:
   - Looks up `/_/hello` in schemas
   - Finds `name` parameter expects `string`
   - Checks actual argument type (e.g., `age` is `number`)
   - Reports type mismatch: "Expected string, got number"

**Pros:**

- ✅ Centralized type definitions
- ✅ Easy to maintain
- ✅ Works without modifying DAG files
- ✅ Can be auto-generated from existing actions

**Cons:**

- ❌ Requires separate schema file
- ❌ Must be kept in sync with actual actions

---

## 📝 **Source 2: Inline Type Declarations in DAG**

**In your `.dag` file:**

```dagular
// Declare function signatures
declare hello: (name: string) => string
declare world: (msg: string) => string
declare sendEmail: (to: string, subject: string, body?: string) => object

// Now use them with type checking
greeting = hello(name: "Dan")  // ✅ OK
badCall = hello(name: 123)     // ❌ ERROR: Expected string, got number
```

**How it works:**

1. Parser extracts `declare` statements
2. Builds type information map: `hello -> (name: string) => string`
3. When validating invocations, checks against declarations
4. Reports mismatches immediately

**Pros:**

- ✅ Type info lives with the code
- ✅ No external files needed
- ✅ Self-documenting

**Cons:**

- ❌ Must declare every action you use
- ❌ Duplicates type info if used in multiple DAGs

---

## 🎯 **Source 3: Variable Type Annotations**

**In your `.dag` file:**

```dagular
#strict  // Enable strict type checking

// Annotate variable types
let userName: string = "Alice"
let userAge: number = 25
let isActive: boolean = true

// Type checking validates invocations
greeting = hello(name: userName)  // ✅ OK: userName is string
badCall = hello(name: userAge)    // ❌ ERROR: userAge is number
```

**How it works:**

1. Compiler builds symbol table: `userName -> string`, `userAge -> number`
2. When seeing `hello(name: userAge)`:
   - Looks up `userAge` type: `number`
   - Looks up `hello`'s `name` parameter expects: `string`
   - Detects mismatch and reports error

**Pros:**

- ✅ Catches type errors early
- ✅ Makes code more readable
- ✅ Enables IDE autocompletion

---

## 🔍 **Source 4: Type Inference from Literals**

**No annotations needed:**

```dagular
// Compiler infers types from literals
let name = "Bob"      // Inferred: string
let age = 30          // Inferred: number
let active = false    // Inferred: boolean

greeting = hello(name: name)  // ✅ OK: inferred string
badCall = hello(name: age)    // ❌ ERROR: inferred number
```

**How it works:**

1. Parser sees `let age = 30`
2. Infers type: `age -> number`
3. Stores in symbol table
4. Uses for subsequent type checks

**Type inference rules:**

- `"text"` → `string`
- `123` or `45.67` → `number`
- `true` or `false` → `boolean`
- `[1, 2, 3]` → `array<number>`
- `{a: 1, b: 2}` → `object`

---

## 🌐 **Source 5: Runtime Introspection** (Advanced)

**Query OpenWhisk at compile time:**

```javascript
// In the compiler
async function resolveActionType(actionPath) {
  // Fetch action from OpenWhisk
  const action = await whiskClient.actions.get(actionPath);

  // Check for type annotations in action metadata
  const typeAnnotation = action.annotations.find(
    (ann) => ann.key === "parameter-types"
  );

  if (typeAnnotation) {
    return JSON.parse(typeAnnotation.value);
  }

  // Parse JSDoc from action source code
  return parseJSDoc(action.exec.code);
}
```

**Action code with JSDoc:**

```javascript
/**
 * @param {string} name - The person's name
 * @returns {string} - A greeting message
 */
function main(params) {
  return { greeting: `Hello, ${params.name}!` };
}
```

**Pros:**

- ✅ Types stay with the action code
- ✅ Single source of truth
- ✅ No manual schema maintenance

**Cons:**

- ❌ Requires OpenWhisk connection at compile time
- ❌ Slower compilation
- ❌ Depends on action annotations being present

---

## 🔄 **Priority Order (Hybrid Approach)**

The compiler uses **all sources** with this priority:

```
1. Inline declarations in DAG (highest priority)
   ↓
2. Schema registry file
   ↓
3. Type definition files (.d.dag)
   ↓
4. Runtime introspection
   ↓
5. Type inference from usage
   ↓
6. Unknown/Any (allow in non-strict mode)
```

**Example:**

```dagular
// Schema says: hello: (name: string) => string
// But we override with inline declaration
declare hello: (name: number) => string  // Override!

let age = 25
greeting = hello(name: age)  // ✅ OK: Uses inline declaration
```

---

## 💡 **Practical Workflow**

### **Recommended Setup:**

1. **Create schema file** (`action-schema.json`):

   ```json
   {
     "/_/hello": {
       "parameters": { "name": { "type": "string", "required": true } },
       "returns": { "type": "string" }
     }
   }
   ```

2. **Enable strict mode** in your DAG:

   ```dagular
   #strict

   let userName: string = input["name"]
   greeting = hello(name: userName)  // Type-checked!
   ```

3. **Compile with validation**:

   ```bash
   wsk dag compile my-workflow.dag --schemas action-schema.json --strict
   ```

4. **Get helpful error messages**:
   ```
   ERROR: Type mismatch for parameter 'name' in /_/hello:
     Expected: string (from schema)
     Got:      number
     Location: line 5, column 21
   ```

---

## 🎓 **Complete Example**

**File: `action-schema.json`**

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

**File: `my-workflow.dag`**

```dagular
#strict

// Variable with type annotation
let userName: string = input["username"]
let userAge: number = input["age"]

// ✅ VALID: userName is string, hello expects string
greeting = hello(name: userName)

// ❌ ERROR: userAge is number, hello expects string
// This line would fail compilation:
// badGreeting = hello(name: userAge)
//
// Error message:
// "Type mismatch for parameter 'name' in /_/hello:
//  expected string (from schema), got number"

return greeting
```

**Compilation:**

```bash
wsk dag compile my-workflow.dag --schemas action-schema.json
```

**Output:**

```
✓ Type checking passed
✓ Compiled successfully to my-workflow.json
```

---

## 🎯 **Summary**

**Q: How does the system know `hello` expects `name: string`?**

**A: It reads from:**

1. **Schema file** (`action-schema.json`) ← Most common
2. **Inline declarations** (`declare hello: (name: string) => string`)
3. **Action metadata** (JSDoc, annotations)
4. **Type inference** (analyzing code flow)

The schema registry (Option 1) is **the recommended approach** because it's:

- Simple to implement
- Easy to maintain
- Doesn't require code changes
- Works with existing actions
- Can be auto-generated

---

## 🚀 **Next Steps**

1. Create `action-schema.json` for your actions
2. Update compiler to load schemas
3. Add type checking validation phase
4. Enable with `--strict` flag
5. Get compile-time type safety!

This gives you **better safety than AWS/Azure/Google Cloud** which only validate at runtime! 🎉
