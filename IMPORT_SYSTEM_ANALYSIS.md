# Dagular Import System - Design & Implementation Analysis

## Your Request Summary

**Current behavior:**
```dagular
/_/sleep2()
/_/sleep3()
/_/hello()
```

**Desired behavior:**
```dagular
sleep2()
sleep3()
hello()
```

**With imports from different namespaces:**
```dagular
import {sleep2} from namespaceA

sleep2()
sleep3()
hello()
```

**Should compile to:**
```
/namespaceA/sleep2()    ← From imported namespace
/_/sleep3()              ← Default namespace
/_/hello()               ← Default namespace
```

---

## Analysis: How Hard Is This?

### ✅ **Difficulty: MODERATE (6-8 hours of work)**

### Breakdown:

#### **Easy Parts (2-3 hours):**
1. ✅ Add `import` keyword to tokenizer
2. ✅ Add import statement parser
3. ✅ Store imports in a symbol table/map

#### **Moderate Parts (2-3 hours):**
4. ✅ Modify identifier resolution in `parsePrimary()`
5. ✅ Track default namespace
6. ✅ Handle namespace prefix conversion during parsing

#### **Tricky Parts (1-2 hours):**
7. ⚠️ Scope management (imports at module level only)
8. ⚠️ Handling both qualified and unqualified names
9. ⚠️ Error handling for unknown imports
10. ⚠️ Testing all edge cases

---

## Implementation Plan

### Step 1: Add Import Parsing

**In tokenizer, add keyword:**
```javascript
{ type: "IMPORT", regex: /^import\b/ },
{ type: "FROM", regex: /^from\b/ },
```

**Add import parser method:**
```javascript
parseImport() {
  // Parse: import {sleep2, sleep3} from namespaceA
  this.consume("IMPORT", "Expected 'import'");
  this.consume("LBRACE", "Expected '{'");
  
  const imports = [];
  do {
    const name = this.consume("IDENTIFIER", "Expected import name");
    imports.push(name.value);
  } while (this.match("COMMA"));
  
  this.consume("RBRACE", "Expected '}'");
  this.consume("FROM", "Expected 'from'");
  const namespace = this.consume("IDENTIFIER", "Expected namespace");
  
  return { imports, namespace: namespace.value };
}
```

### Step 2: Track Imports in Compiler

**Add to constructor:**
```javascript
constructor() {
  this.tokens = [];
  this.current = 0;
  this.imports = new Map();        // actionName -> namespace
  this.defaultNamespace = "_";    // Default to guest
}
```

**Process imports at start of compilation:**
```javascript
compile(source) {
  try {
    this.tokenize(source);
    this.current = 0;
    
    // Extract and process imports
    this.processImports();
    
    // Now parse the rest
    const ast = this.parseProgram();
    return ast;
  } catch (error) {
    throw new Error(`Compilation failed: ${error.message}`);
  }
}

processImports() {
  while (this.check("IMPORT")) {
    const importData = this.parseImport();
    
    // Map each imported function to its namespace
    for (const funcName of importData.imports) {
      this.imports.set(funcName, importData.namespace);
    }
  }
}
```

### Step 3: Resolve Function Names During Parsing

**Modify `parsePrimary()` to handle identifiers:**
```javascript
// In parsePrimary(), when matching IDENTIFIER:
if (this.match("IDENTIFIER")) {
  const name = this.previous().value;
  
  // Check if this identifier is an imported function
  if (this.imports.has(name)) {
    const namespace = this.imports.get(name);
    const fullPath = `/${namespace}/${name}`;
    return this.createNode("id", [fullPath]);
  }
  
  // Check if it's already a qualified name
  if (name.startsWith("/")) {
    return this.createNode("id", [name]);
  }
  
  // Default: add default namespace prefix
  const fullPath = `/${this.defaultNamespace}/${name}`;
  return this.createNode("id", [fullPath]);
}
```

### Step 4: Modify ACTION_PATH Tokenization

**Update regex to match unqualified names:**
```javascript
// Current (requires leading /):
{ type: "ACTION_PATH", regex: /^\/[a-zA-Z0-9_\/-]+/ },

// Would remain for explicit paths
// But identifiers are handled separately
```

---

## Example Workflow

### Input DAG File:
```dagular
import {sleep2} from namespaceA
import {process} from namespaceB

result1 = sleep2()      // From namespaceA
result2 = sleep3()      // From default namespace (_)
result3 = hello()       // From default namespace (_)
result4 = process()     // From namespaceB

return [result1, result2, result3, result4]
```

### Compilation Steps:

**1. Tokenization:**
```
IMPORT, LBRACE, IDENTIFIER(sleep2), RBRACE, FROM, IDENTIFIER(namespaceA)
IMPORT, LBRACE, IDENTIFIER(process), RBRACE, FROM, IDENTIFIER(namespaceB)
...
```

**2. Import Processing:**
```
imports map:
  sleep2 → namespaceA
  process → namespaceB
```

**3. Parsing:**
```
sleep2() → resolve to /namespaceA/sleep2
sleep3() → resolve to /_/sleep3
hello()  → resolve to /_/hello
process()→ resolve to /namespaceB/process
```

**4. Output JSON AST:**
```json
{
  "data": "block_expr",
  "children": [
    {
      "data": "assign",
      "children": [
        {"data": "id", "children": ["result1"]},
        {"data": "invocation", "children": ["/namespaceA/sleep2", {"data": "dict", "children": []}]}
      ]
    },
    ...
  ]
}
```

---

## Code Changes Summary

### Files to Modify:
1. **commands/dagular/dagular_compiler.js**
   - Add IMPORT, FROM tokens
   - Add parseImport() method
   - Add processImports() method
   - Modify parsePrimary() to resolve imports
   - Add imports Map to constructor
   - Add defaultNamespace property

### Files to Update:
2. **commands/dagular/dagular_language_spec.md**
   - Add Import statement documentation
   - Update examples to show both old and new syntax

---

## Backwards Compatibility

**Fully backwards compatible!**

Old syntax still works:
```dagular
/_/sleep2()     // Still works - explicit path
/_/namespaceA/sleep2()  // Still works - full path
```

New syntax:
```dagular
sleep2()                    // Now works - implicit default namespace
import {sleep2} from namespaceA
sleep2()                    // Now works - explicit import
```

---

## Benefits of This Change

✅ **Cleaner syntax** - No need for `/_/` prefix on every action
✅ **Better imports** - Like Python/JavaScript imports
✅ **Namespace management** - Clear where each function comes from
✅ **DRY principle** - Don't repeat `/_/` everywhere
✅ **Readable** - More like regular programming languages
✅ **Scalable** - Works with many namespaces without clutter

---

## Potential Issues & Solutions

### Issue 1: Circular Imports
**Solution:** Not applicable in single-file Dagular (no modules yet)

### Issue 2: Name Conflicts
```dagular
import {hello} from namespaceA
import {hello} from namespaceB  // ERROR: hello already imported
```
**Solution:** Add validation in processImports()

### Issue 3: Using Imported Name as Variable
```dagular
import {sleep2} from namespaceA
let sleep2 = 42  // ERROR: name already used for import
```
**Solution:** Track imported names, block them as variable names

### Issue 4: Partial Imports
```dagular
import {sleep2} from namespaceA
sleep3()  // Should resolve to /_/sleep3, not error
```
**Solution:** Already handled - only imported names use the import namespace

---

## Testing Strategy

### Test Cases:

```dagular
// Test 1: Simple import
import {sleep2} from namespaceA
sleep2()
// Should compile to: /namespaceA/sleep2()

// Test 2: Multiple imports from same namespace
import {sleep2, sleep3} from namespaceA
sleep2()
sleep3()
// Should compile to: /namespaceA/sleep2(), /namespaceA/sleep3()

// Test 3: Mixed imported and default
import {sleep2} from namespaceA
sleep2()
hello()
// Should compile to: /namespaceA/sleep2(), /_/hello()

// Test 4: Multiple imports from different namespaces
import {sleep2} from namespaceA
import {process} from namespaceB
sleep2()
process()
hello()
// Should compile to: /namespaceA/sleep2(), /namespaceB/process(), /_/hello()

// Test 5: Backwards compatibility
/_/sleep2()
/_/hello()
// Should still work exactly as before

// Test 6: Error - import unknown function
import {nonexistent} from namespaceA
nonexistent()
// Should not error (validation happens at runtime)

// Test 7: Error - duplicate import
import {sleep2} from namespaceA
import {sleep2} from namespaceB
// Should error: duplicate import name

// Test 8: Error - use imported name as variable
import {sleep2} from namespaceA
let sleep2 = 42
// Should error: name conflict
```

---

## Estimated Effort Breakdown

| Task | Hours | Difficulty |
|------|-------|------------|
| Add tokenizer keywords | 0.5 | Easy |
| Implement import parser | 1.5 | Easy |
| Implement processImports | 1 | Easy |
| Modify identifier resolution | 1.5 | Medium |
| Error handling & validation | 1.5 | Medium |
| Testing | 1.5 | Medium |
| Documentation update | 0.5 | Easy |
| **TOTAL** | **8 hours** | **Moderate** |

---

## Implementation Order

1. **Phase 1:** Add tokenizer + import parser (1 hour)
2. **Phase 2:** Add symbol table + processImports (1.5 hours)
3. **Phase 3:** Modify identifier resolution (1.5 hours)
4. **Phase 4:** Error handling (1 hour)
5. **Phase 5:** Testing (2 hours)
6. **Phase 6:** Documentation (0.5 hours)

---

## My Recommendation

**This is a GREAT feature to implement!** Here's why:

✅ **Improves readability** significantly
✅ **Reasonable effort** - 8 hours is doable
✅ **Well-scoped** - Clear boundaries
✅ **Backwards compatible** - No breaking changes
✅ **Follows conventions** - Like other languages (Python, JS)
✅ **Enables future features** - Module system foundation

**I can implement this for you if you'd like!**

---

## Next Steps

Would you like me to:

1. **Implement the full feature** - I'll code it up with tests
2. **Start with Phase 1-2** - Get basic structure in place
3. **Create detailed spec** - More thorough design doc
4. **Review implementation** - If you want to code it yourself

Let me know! 🚀

