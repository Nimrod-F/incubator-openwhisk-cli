<!--
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
-->

# OpenWhisk CLI with Dagular DSL

This is a modified version of the [Apache OpenWhisk](https://openwhisk.apache.org/) CLI (`wsk`) that adds **Dagular** -- a functional domain-specific language for composing serverless workflows with implicit parallelism and compile-time type safety.

---

## Table of Contents

- [Overview](#overview)
- [How OpenWhisk Works](#how-openwhisk-works)
- [What is Dagular](#what-is-dagular)
- [Architecture](#architecture)
- [Building from Source](#building-from-source)
- [Dagular Language Reference](#dagular-language-reference)
- [Import System](#import-system)
- [Type Checking](#type-checking)
- [Redis Type Persistence](#redis-type-persistence)
- [Deployment Interception](#deployment-interception)
- [Complete Workflow Example](#complete-workflow-example)
- [CLI Command Reference](#cli-command-reference)

---

## Overview

Apache OpenWhisk is an open-source serverless platform. Functions (called **actions**) are deployed and invoked on demand. The platform handles scaling, resource allocation, and execution.

The standard `wsk` CLI lets you create, invoke, and manage actions. This modified version adds the `wsk dag` command group, which introduces the Dagular language for composing multiple actions into workflows.

**What this project adds to the standard CLI:**

| Feature | Description |
|---------|-------------|
| Dagular compiler | Compiles `.dag` files into JSON DAG representations |
| Import system | Short action names that auto-resolve to full OpenWhisk paths |
| Type checker | Catches type mismatches at compile time, before deployment |
| Redis persistence | Stores action type schemas in Redis instead of a static file |
| Deployment interception | Automatically extracts type signatures from action source code and stores them in Redis when you deploy |
| Action validator | Verifies referenced actions exist before deployment |

---

## How OpenWhisk Works

OpenWhisk runs serverless functions called **actions**. Here is the basic flow:

```
Developer writes a function (e.g. hello.js)
    |
    v
Deploys it:  wsk action create hello hello.js
    |
    v
OpenWhisk stores it in CouchDB
    |
    v
Invokes it:  wsk action invoke hello --param name "Alice"
    |
    v
Controller receives the request via REST API
    |
    v
Dispatches to an Invoker via Kafka
    |
    v
Invoker runs the function in a container
    |
    v
Result is stored as an "activation" in CouchDB
    |
    v
Developer gets the result:  wsk activation result <id>
```

### Key concepts

- **Action**: A function deployed to OpenWhisk. Can be written in JavaScript, Python, Go, Java, etc.
- **Activation**: A record of a single invocation (input, output, timing, errors).
- **Namespace**: Actions are organized into namespaces. The default namespace is `_`, giving paths like `/_/hello`.
- **Parameters**: Actions receive and return JSON objects.

### The problem Dagular solves

OpenWhisk has no native way to compose actions. If you want to call action B with the result of action A, you must write code inside A that makes an HTTP call to B. This is:
- **Verbose**: requires HTTP client code inside every action
- **Opaque**: the dependency structure is hidden in imperative code
- **Untyped**: no way to check at compile time that A's output matches B's expected input
- **Sequential by default**: parallelism requires manual coordination

Dagular solves all four problems.

---

## What is Dagular

Dagular is a functional DSL (Domain-Specific Language) that lets you express serverless workflows as short, readable programs. The compiler transforms them into JSON DAGs (Directed Acyclic Graphs) that the OpenWhisk runtime executes, automatically running independent branches in parallel.

### A simple example

```
let greeting = hello(name: "Alice")
let result   = world(msg: greeting)
result
```

This program:
1. Calls the `hello` action with parameter `name = "Alice"`
2. Passes the result to the `world` action as parameter `msg`
3. Returns the final result

The compiler produces a JSON DAG with two nodes and one edge (greeting -> result). The runtime sees that `hello` must run first (because `world` depends on its output) and executes them sequentially.

### Automatic parallelism

```
let a = slow2()
let b = slow3()
let result = combine(x: a, y: b)
result
```

Here `slow2` and `slow3` have no dependency on each other. The runtime detects this from the DAG structure and runs them **in parallel** -- no explicit annotation needed. `combine` waits for both to finish.

---

## Architecture

```
                          +------------------+
                          |   .dag source    |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |              |               |
               Import Parser   Compiler     Type Checker
               (resolves       (tokenizer,   (validates
                namespaces)    parser, AST)   types)
                    |              |               |
                    +--------------+--------------+
                                   |
                          +--------v---------+
                          |   JSON DAG AST   |
                          +--------+---------+
                                   |
                     +-------------+-------------+
                     |                           |
              wsk dag compile             wsk dag deploy
              (outputs JSON)              (sends to OpenWhisk)
                                                 |
                                          +------v------+
                                          |  OpenWhisk  |
                                          |   Runtime   |
                                          +-------------+
```

### File structure

```
commands/
  dag.go                          # Go entry point: compile, deploy commands
  dag_types.go                    # Go: wsk dag types subcommands (Redis)
  redis.go                        # Go: Redis client wrapper
  dagular/
    dagular_compiler.js           # JavaScript: tokenizer + parser + code generator
    type_checker.js               # JavaScript: type inference and validation
    compiler_with_types.js        # JavaScript: compile + type check orchestration
    action_validator.js           # JavaScript: checks actions exist in OpenWhisk
    dagular_language_spec.md      # Language specification
actions/dag/
    action-schema.json            # Static type schema file (legacy, replaced by Redis)
    *.dag                         # Example Dagular programs
```

### How Go and JavaScript work together

The Dagular compiler and type checker are written in JavaScript. They are embedded into the Go binary at compile time using Go's `//go:embed` directive:

```go
//go:embed dagular/dagular_compiler.js
var compilerJS []byte

//go:embed dagular/type_checker.js
var typeCheckerJS []byte
```

At runtime, the Go code creates a JavaScript VM using [goja](https://github.com/nicktrav/goja) (a pure-Go JS runtime), loads the embedded JS code, and calls compiler/type-checker functions through the VM. This means the final `wsk` binary has zero external dependencies.

---

## Building from Source

### Prerequisites

- Go 1.22 or higher
- Redis (for type persistence features)

### Build

```sh
git clone <this-repo>
cd incubator-openwhisk-cli
go build -o wsk .
```

### Start Redis

```sh
# macOS
brew install redis
redis-server --daemonize yes

# Linux
sudo apt install redis-server
sudo systemctl start redis
```

### Configure OpenWhisk connection

```sh
./wsk property set --apihost <your-openwhisk-host>
./wsk property set --auth <your-auth-key>
```

---

## Dagular Language Reference

### Literals

```
"hello"          # string
42               # integer
3.14             # float
true / false     # boolean
```

### Variable binding

```
let name = "Alice"
let age = 25
```

### Action invocation

Actions are serverless functions. Call them with named parameters:

```
hello(name: "Alice")
add(a: 1, b: 2)
```

### Arithmetic and logical operators

```
let sum   = a + b          # addition
let diff  = a - b          # subtraction
let prod  = a * b          # multiplication
let quot  = a / b          # division
let rem   = a % b          # modulo

let both  = x and y        # logical AND
let either = x or y        # logical OR
let neg   = not x          # logical NOT
```

### Conditionals

```
let result = if condition then valueA else valueB
```

### Lambda functions

```
let double = \x -> add(a: x, b: x)
let result = double(5)
```

### Map (apply to each element)

```
let results = map users with \u -> process(user: u)
```

### Return value

The last expression in a program is its return value:

```
let greeting = hello(name: "Alice")
let result = world(msg: greeting)
result
```

---

## Import System

### The problem

Without imports, every action invocation requires a fully-qualified OpenWhisk path:

```
let result = /_/hello(name: "Alice")
let payment = /payments/processPayment(amount: 100)
```

This is verbose and couples programs to namespace layout.

### The solution

**Default namespace**: bare names auto-resolve to `/_/name`:

```
let result = hello(name: "Alice")
# Compiles to: /_/hello(name: "Alice")
```

**Explicit imports** for other namespaces:

```
import { processPayment } from payments
let confirmation = processPayment(amount: 100)
# Compiles to: /payments/processPayment(amount: 100)
```

### Resolution rules (in order)

1. If the name starts with `/` -- use as-is (explicit path)
2. If the name is in an `import` statement -- resolve to imported namespace
3. If the name is a local variable (let binding, lambda param, map variable) -- treat as function application, not action invocation
4. Otherwise -- resolve to `/_/name` (default namespace)

### Example

```
import { sleep2 } from namespaceA

let greeting = hello(name: "Alice")        # resolves to /_/hello
let delayed  = sleep2()                     # resolves to /namespaceA/sleep2
let doubled  = /_/add(a: 1, b: 1)          # explicit path, unchanged
```

### Implementation

The import system is implemented across:
- `dagular_compiler.js`: `IMPORT` token, `parseImportStatement()`, `processImports()`, modified `parsePostfix()` with 4-step resolution
- `dag.go`: `parseImportStatements()` (Go-side regex parser for action extraction), updated `extractActionInvocations()`
- `type_checker.js` and `compiler_with_types.js`: import-aware schema lookups

The keyword `from` is **contextual** -- it is only recognized after `import {...}`, so `let from = 42` remains valid.

---

## Type Checking

### What it does

The type checker catches type errors at compile time, before any code is deployed to OpenWhisk. It validates that action parameters receive the correct types.

### How it works

Type checking has multiple sources of type information, used in priority order:

```
Priority 1 (highest): Inline declarations in .dag file
    declare hello: (name: string) => string

Priority 2: Redis (persistent type store)
    Schemas stored via wsk dag types register

Priority 3: Static file (legacy)
    action-schema.json

Priority 4 (lowest): Type inference from code
    Infers types from literals and detects inconsistent usage
```

### Example: type error caught

Given the schema `/_/hello` expects `name: string`:

```
let result = hello(name: 42)
# ERROR: Type mismatch for parameter 'name' in /_/hello: expected string, got number
```

### Skipping type checks

```sh
./wsk dag compile myfile.dag --skip-type-check
```

---

## Redis Type Persistence

### The problem

The original type checker read action type schemas from a static JSON file (`action-schema.json`). This file had to be maintained by hand and was not a real persistence solution.

### The solution

Type schemas are now stored in **Redis**, a fast key-value database. This provides:
- **Persistence**: schemas survive CLI restarts
- **Dynamic updates**: register new schemas at any time
- **No manual file maintenance**: the dummy file is no longer needed
- **Backward compatibility**: if Redis is unavailable, falls back to the JSON file

### Redis key structure

```
dagular:schema:/_/hello      -> {"parameters":{"name":{"type":"string","required":true}},"returns":{"type":"string"}}
dagular:schema:/_/add        -> {"parameters":{"a":{"type":"number"},"b":{"type":"number"}},"returns":{"type":"number"}}
dagular:schema:/ns/action    -> ...
```

### Schema resolution order

When `wsk dag compile` or `wsk dag deploy` runs:

1. **`--schemas` flag** (explicit file path) -- highest priority
2. **Redis** -- queries for schemas of all referenced actions
3. **Auto-discovered file** (searches for `action-schema.json` near the `.dag` file)
4. **No schemas** -- type checking is skipped

### Managing schemas

```sh
# Import from an existing schema file
wsk dag types import actions/dag/action-schema.json

# Register a single action schema
wsk dag types register /_/greet --json '{"parameters":{"msg":{"type":"string","required":true}},"returns":{"type":"string"}}'

# View all registered schemas
wsk dag types list

# View a specific schema
wsk dag types get /_/hello

# Delete a schema
wsk dag types delete /_/hello

# Export all schemas to a file
wsk dag types export --output schemas.json
```

### Redis connection

- **Default**: `localhost:6379`
- **Environment variable**: `DAGULAR_REDIS_URL=redis://:password@host:port/db`
- **CLI flag**: `--redis-url redis://host:port/db`

### Implementation

Three files implement the Redis integration:
- `commands/redis.go`: Redis client wrapper (connect, set, get, delete, list, pipeline queries)
- `commands/dag_types.go`: Six CLI subcommands (register, get, list, delete, import, export)
- `commands/dag.go`: Modified `loadTypeSchemas()` to query Redis before falling back to the file

The JavaScript type checker (`type_checker.js`) was **not modified** -- it already accepts a schemas object. Only the Go layer changed (where the schemas come from).

---

## Deployment Interception

### The problem

Before this feature, there was a gap in the pipeline. You would deploy an action to OpenWhisk, and then separately have to tell the system what types that action expects. These were two disconnected steps. If you forgot the second step, there was no type checking.

Think of it like this: imagine you hire a new employee, but you forget to give them a name badge. Nobody knows who they are or what they do. That is what deploying an action without registering its types was like.

### The solution

Now, when you deploy an action with `wsk action create`, the CLI does two things at once:

1. **Deploys the code** to OpenWhisk (same as before)
2. **Reads the source file**, looks for special annotations that describe the types, and **saves them to Redis automatically**

This means: you deploy once, and type information is available everywhere, immediately, with no extra steps.

### How it works

Every programming language has comments. We use a simple, universal annotation format inside those comments:

**JavaScript** (`hello.js`):
```javascript
// @param name: string
// @returns: string
function main(params) {
    return { greeting: "Hello " + params.name };
}
```

**Python** (`add.py`):
```python
# @param a: number
# @param b: number
# @returns: number
def main(params):
    return {"result": params["a"] + params["b"]}
```

**Java** (`SendEmail.java`):
```java
// @param to: string
// @param subject: string
// @param body: string
// @returns: object
public class SendEmail {
    public static JsonObject main(JsonObject args) { ... }
}
```

**Go**, **Swift**, **PHP**, **Ruby** -- any language with `//` or `#` comments works the same way.

### What happens when you deploy

```
$ wsk action create hello hello.js
ok: created action hello
ok: persisted type signature (1 param(s)) for hello to Redis
```

Two things happened:
1. The action `hello` was deployed to OpenWhisk
2. The CLI read `hello.js`, found `// @param name: string` and `// @returns: string`, and stored `{name: string} -> string` in Redis under `dagular:schema:/_/hello`

Now, if someone writes a Dagular workflow that calls `hello(name: 42)`, the type checker will catch it immediately -- no manual registration needed.

### Type normalization

The extractor understands type names from different languages and normalizes them:

| You write | Dagular understands |
|-----------|-------------------|
| `string`, `String`, `str`, `CharSequence` | `string` |
| `number`, `int`, `Integer`, `long`, `float`, `double`, `Number` | `number` |
| `boolean`, `Boolean`, `bool` | `boolean` |
| `object`, `Object`, `dict`, `map`, `JsonObject` | `object` |
| `array`, `Array`, `list`, `List`, `JsonArray` | `array` |

So a Java developer can write `// @param name: String` and a Python developer can write `# @param name: str` -- both produce the same result in Redis.

### Implementation

The interception is implemented in two files:

- **`commands/redis.go`**: Contains `extractSignatureFromSource()` which uses a regex to find `@param` and `@returns` annotations in any source file, and `persistActionSignature()` which stores the result in Redis.
- **`commands/action.go`**: Contains `interceptDeployment()` which is called after every successful `wsk action create` and `wsk action update`. It reads the source file, calls the extractor, and persists to Redis. If Redis is not running, it silently does nothing -- the deploy still succeeds.

### Annotation format reference

```
// @param <name>: <type>       Declares a parameter and its type
// @returns: <type>            Declares the return type

# @param <name>: <type>       Same thing, for languages that use # comments
# @returns: <type>
```

---

## Complete Workflow Example

### 1. Deploy actions with type annotations

```sh
wsk action create hello hello.js       # hello.js has @param and @returns annotations
wsk action create add add.py           # add.py has @param and @returns annotations
```

The CLI automatically extracts the type signatures and stores them in Redis. No extra steps needed.

### 2. Write a Dagular program

`my-workflow.dag`:
```
let greeting = hello(name: "Alice")
let sum      = add(a: 1, b: 2)
greeting
```

### 3. Compile (type checks against Redis)

```sh
wsk dag compile my-workflow.dag
# Output:
#   Type checking against: Redis
#   V Type checking passed
#   {"data":"block_expr","children":[...]}
```

### 4. See what happens with a type error

```
let greeting = hello(name: 42)       # 42 is a number, but hello expects a string!
```

```sh
wsk dag compile bad-workflow.dag
#   Type checking against: Redis
#   X Type checking failed
#   Type errors:
#     - Type mismatch for parameter 'name' in /_/hello: expected string, got number
```

The error was caught **before deployment** -- no broken code reached the server.

### 5. Deploy the workflow to OpenWhisk

```sh
wsk dag deploy my-workflow.dag --name my-workflow
# Output:
#   V All 2 referenced action(s) validated successfully
#   Type checking against: Redis
#   V Type checking passed
#   ok: created action my-workflow
```

### 6. Invoke the workflow

```sh
wsk action invoke my-workflow --result
# OpenWhisk executes the DAG: hello and add run in parallel, returns result
```

---

## CLI Command Reference

### Standard OpenWhisk commands

| Command | Description |
|---------|-------------|
| `wsk action create NAME FILE` | Deploy a function |
| `wsk action invoke NAME` | Invoke a function |
| `wsk action list` | List all functions |
| `wsk activation list` | List recent invocations |
| `wsk activation result ID` | Get invocation result |

### Dagular commands

| Command | Description |
|---------|-------------|
| `wsk dag compile FILE` | Compile a `.dag` file to JSON AST |
| `wsk dag deploy FILE --name NAME` | Compile and deploy as a Dagular action |
| `wsk dag types register PATH --json JSON` | Store a type schema in Redis |
| `wsk dag types get PATH` | View a schema from Redis |
| `wsk dag types list` | List all schemas in Redis |
| `wsk dag types delete PATH` | Remove a schema from Redis |
| `wsk dag types import FILE` | Bulk import schemas from JSON file to Redis |
| `wsk dag types export` | Export all Redis schemas to JSON |

### Dagular compile flags

| Flag | Description |
|------|-------------|
| `-o, --output FILE` | Write JSON to file instead of stdout |
| `--validate-actions` | Check that referenced actions exist in OpenWhisk |
| `--skip-type-check` | Skip type checking |
| `-s, --schemas FILE` | Explicit path to schema file (overrides Redis) |
| `--redis-url URL` | Redis connection URL |

### Dagular deploy flags

| Flag | Description |
|------|-------------|
| `-n, --name NAME` | Name for the deployed action (required) |
| `--skip-validation` | Skip action existence validation |
| `--skip-type-check` | Skip type checking |
| `--verbose` | Show detailed output |
| `-s, --schemas FILE` | Explicit path to schema file |
| `--redis-url URL` | Redis connection URL |
