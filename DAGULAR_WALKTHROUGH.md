# Dagular: A Complete Walkthrough

## What is Dagular?

**Dagular** is a simple, readable programming language designed to make it easy to write **serverless workflows** in OpenWhisk. Instead of writing complex JSON or imperative code, you write clean, declarative workflows that the compiler converts to optimized JSON.

### The Problem It Solves

Without Dagular, OpenWhisk workflows are verbose:

```json
{
  "data": "block_expr",
  "children": [
    {
      "data": "return",
      "children": [
        {
          "data": "invocation",
          "children": [
            "/_/hello",
            {
              "data": "dict",
              "children": [
                {
                  "data": "pair",
                  "children": [
                    { "data": "id", "children": ["name"] },
                    { "data": "string", "children": ["world"] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

With Dagular, it's just:

```dagular
hello(name: "world")
```

Much better! ✨

---

## Core Concepts

### 1. **Actions**
An **action** is a serverless function deployed in OpenWhisk. Actions are referenced by their path starting with `/`:

```dagular
/_/hello         // Reference to the "hello" action
/_/sendEmail     // Reference to the "sendEmail" action
/_/process/data  // Reference to "data" action in "process" package
```

### 2. **Action Invocation**
**Call** an action with parameters:

```dagular
/_/hello(name: "Alice")

// Multiple parameters
/_/sendEmail(to: "user@example.com", subject: "Hello", body: "Hi there!")
```

### 3. **Variables**
Store results and intermediate values:

```dagular
// Declare a variable
let greeting = hello(name: "Bob")

// Use the result
message = sendEmail(to: "bob@example.com", subject: greeting)
```

### 4. **Return Statement**
Return the final result of your workflow:

```dagular
greeting = hello(name: "Alice")
return greeting
```

---

## Simple Examples

### Example 1: Single Action Call

**File: hello.dag**
```dagular
hello(name: "world")
```

**What it does:**
- Calls the `/_/hello` action
- Passes `name: "world"` as parameter
- Returns the result

**Compiled to:** Complex JSON AST

### Example 2: Sequential Execution

**File: sequential.dag**
```dagular
/_/slow3()
/_/slow2()
```

**What it does:**
1. Call `slow3()` first (wait for result)
2. Then call `slow2()` (wait for result)
3. Execute one after another

**Use case:** When second action needs output from first

### Example 3: Parallel Execution

**File: parallel.dag**
```dagular
[/_/slow3(), /_/slow2()]
```

**What it does:**
- Call both `slow3()` and `slow2()` **simultaneously**
- Wait for both to complete
- Return array of results: `[result3, result2]`

**Use case:** Faster execution when tasks are independent

### Example 4: Variables and Assignment

**File: with_assignment.dag**
```dagular
let x = slow3()
let y = slow2()
return [x, y]
```

**What it does:**
1. Call `slow3()`, store result in `x`
2. Call `slow2()`, store result in `y`  (runs in parallel)
3. Return array containing both results

**Use case:** Build complex workflows with intermediate values

---

## Practical Workflow Examples

### Email Notification Workflow

```dagular
// Get user data
let userName = input["name"]
let userEmail = input["email"]

// Generate personalized greeting
greeting = hello(name: userName)

// Send confirmation email
confirmation = sendEmail(
  to: userEmail,
  subject: "Hello " + userName,
  body: greeting
)

return {
  greeting: greeting,
  emailSent: confirmation
}
```

**Flow:**
1. Extract input parameters
2. Call `hello` action to create greeting
3. Call `sendEmail` with greeting and email
4. Return both results

### Multi-Step Data Processing

```dagular
// Process user data
let userId = input["userId"]

// Fetch user
user = getUser(id: userId)

// Validate user
validated = validateUser(userData: user)

// Process if valid
if validated {
  result = processData(user: user)
  return {status: "success", data: result}
} else {
  return {status: "error", message: "Invalid user"}
}
```

**Features used:**
- Variables
- Conditional logic (if/else)
- Named parameters
- Return objects

### Parallel API Calls

```dagular
let query = input["query"]

// Call multiple APIs in parallel
results = [
  searchGoogle(q: query),
  searchBing(q: query),
  searchDuckDuckGo(q: query)
]

return {
  google: results[0],
  bing: results[1],
  duckduckgo: results[2]
}
```

**What it does:**
- All three searches run simultaneously
- Much faster than sequential
- Returns results from all three

---

## Data Types

Dagular supports common data types:

### Primitives
```dagular
42                          // Number (integer)
3.14                        // Number (float)
"hello world"               // String
true, false                 // Boolean
```

### Collections
```dagular
[1, 2, 3, 4, 5]            // Array
["a", "b", "c"]            // Array of strings
[true, 42, "mixed"]        // Mixed types in array

{name: "Alice", age: 30}   // Object (dictionary)
{x: 10, y: 20}             // Object with properties
{}                         // Empty object
[]                         // Empty array
```

### Access Collection Elements
```dagular
let arr = [1, 2, 3]
first = arr[0]    // Get first element (1)

let obj = {name: "Bob", age: 25}
name = obj["name"]  // Get property ("Bob")
```

---

## Operators

### Arithmetic
```dagular
let sum = 5 + 3           // 8
let diff = 10 - 4         // 6
let product = 3 * 7       // 21
let quotient = 20 / 4     // 5
let remainder = 17 % 5    // 2
```

### Comparison
```dagular
let equal = 5 == 5              // true
let notEqual = 5 != 3           // true
let less = 3 < 5                // true
let lessOrEqual = 5 <= 5        // true
let greater = 10 > 5            // true
let greaterOrEqual = 5 >= 5     // true
```

### Logical
```dagular
let both = true and false      // false
let either = true or false     // true
let negated = not true         // false
```

### String Concatenation
```dagular
let greeting = "Hello " + "World"  // "Hello World"
let message = "Welcome, " + name   // Concatenate with variable
```

---

## Control Flow

### If-Else Conditional

```dagular
let age = input["age"]

if age >= 18 {
  status = "adult"
} else {
  status = "minor"
}

return status
```

**Use cases:**
- Different processing based on conditions
- Validation logic
- Branching workflows

### Map (Loop Over Collections)

```dagular
let numbers = [1, 2, 3, 4, 5]

// Double each number
doubled = map num in numbers {
  return num * 2
}
// Result: [2, 4, 6, 8, 10]

// Process each user
let users = input["users"]
processed = map user in users {
  return {name: user.name, adult: user.age >= 18}
}
```

**Use cases:**
- Transform lists
- Apply action to each item
- Filter or enrich data

---

## Type Safety (Optional)

Dagular can optionally enforce **type checking** to catch errors early.

### Strict Mode

Enable with `#strict` directive:

```dagular
#strict

// Now all types must be known
declare hello: (name: string) => string

let userName: string = "Alice"
greeting = hello(name: userName)  // ✅ OK: string matches string
```

### Type Declarations

Declare what types your actions expect:

```dagular
declare hello: (name: string) => string
declare getUser: (id: number) => {id: number, name: string}
declare sendEmail: (to: string, subject: string, body?: string) => boolean

// Now the compiler validates parameter types
```

### Benefits
- ✅ Catch type mismatches before deployment
- ✅ Better documentation
- ✅ IDE support (eventually)
- ✅ Confidence in production workflows

---

## Using Dagular in the CLI

### 1. Write a Workflow

Create `myworkflow.dag`:
```dagular
greeting = hello(name: "Alice")
return greeting
```

### 2. Compile to JSON

```bash
wsk dag compile myworkflow.dag
```

**Output:** The compiled JSON AST

Save to file:
```bash
wsk dag compile myworkflow.dag --output myworkflow.json
```

### 3. Deploy as Action

```bash
wsk dag deploy myworkflow.dag --name myWorkflow
```

This creates an OpenWhisk action that can be invoked like any other.

### 4. Invoke It

```bash
wsk action invoke myWorkflow --result
```

### 5. Use It in Other Workflows

```dagular
result = myWorkflow(...)
```

---

## Advanced Features

### Validation

Before deploying, Dagular validates that all referenced actions exist:

```bash
wsk dag deploy myworkflow.dag --name myWorkflow --verbose
```

**Output:**
```
Validating referenced actions...
Found 3 action invocation(s) to validate
  Checking /_/hello... OK
  Checking /_/sendEmail... OK
  Checking /_/notFound... NOT FOUND

❌ Validation failed: Some referenced actions are not deployed

Missing actions:
  • /_/notFound

Please deploy the missing actions first:
  wsk action create notFound notFound.js
```

### Skip Validation (Not Recommended)

```bash
wsk dag deploy myworkflow.dag --name myWorkflow --skip-validation
```

Use only when you know what you're doing!

### Type Checking with Schemas

```bash
wsk dag deploy myworkflow.dag --name myWorkflow --schemas action-schema.json
```

Provides type information from a schema file.

---

## File Structure

**Your Dagular files:**
- `actions/dag/*.dag` - Dagular source files
- `actions/dag/*.json` - Compiled outputs
- `actions/dag/action-schema.json` - Type schemas

**Language files:**
- `commands/dagular/dagular_compiler.js` - The compiler
- `commands/dagular/type_checker.js` - Type validation
- `commands/dagular/dagular_language_spec.md` - Full language reference
- `commands/dag.go` - CLI integration (Go)

---

## Complete Example Workflow

Here's a real-world scenario:

**File: order-processor.dag**
```dagular
#strict

declare getOrder: (orderId: number) => {id: number, total: number, items: object}
declare validatePayment: (amount: number, method: string) => boolean
declare shipOrder: (orderId: number) => {trackingId: string, eta: string}
declare sendConfirmation: (email: string, subject: string, body: string) => boolean

// Get input
let orderId: number = input["orderId"]
let email: string = input["email"]
let paymentMethod: string = input["paymentMethod"]

// Fetch order details
order = getOrder(orderId: orderId)

// Validate payment
paymentValid = validatePayment(amount: order.total, method: paymentMethod)

if paymentValid {
  // Ship the order
  shipment = shipOrder(orderId: orderId)
  
  // Send confirmation
  confirmation = sendConfirmation(
    email: email,
    subject: "Order Shipped",
    body: "Your order is on the way! Tracking: " + shipment.trackingId
  )
  
  return {
    status: "success",
    shipment: shipment,
    confirmed: confirmation
  }
} else {
  return {
    status: "failed",
    message: "Payment validation failed"
  }
}
```

**What it does:**
1. Gets order details
2. Validates payment
3. If valid: ships order and sends confirmation
4. Returns appropriate result

---

## Summary

**Dagular is:**
- ✅ Simple, readable syntax for workflows
- ✅ Compiles to JSON AST for OpenWhisk
- ✅ Type-safe (optional strict mode)
- ✅ Supports sequences, parallel execution, conditionals
- ✅ Built-in action validation
- ✅ Part of the OpenWhisk CLI

**Use Dagular when you need:**
- Serverless workflow orchestration
- Clear, maintainable workflow definitions
- Type safety and validation
- Fast development of complex action chains

**Start with:**
```bash
# 1. Create a simple workflow
echo 'hello(name: "world")' > simple.dag

# 2. Compile it
wsk dag compile simple.dag

# 3. Deploy it
wsk dag deploy simple.dag --name simpleGreeting

# 4. Use it
wsk action invoke simpleGreeting --result
```

That's Dagular! 🚀

