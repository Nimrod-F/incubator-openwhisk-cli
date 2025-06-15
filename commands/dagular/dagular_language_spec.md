# Dagular Language Specification

## Overview

Dagular is a domain-specific language (DSL) designed for expressing computations and action invocations that compile to JSON Abstract Syntax Tree (AST) format. The language supports functional programming constructs, control flow, and seamless integration with external actions.

## Lexical Structure

### Comments
```
// Single-line comment
/* Multi-line comment */
```

### Keywords
- `let` - Variable declaration
- `return` - Return statement
- `if` / `else` - Conditional expressions
- `map` / `in` - Collection mapping
- `true` / `false` - Boolean literals
- `not` / `and` / `or` - Logical operators

### Literals

#### Numbers
- Integer: `42`, `0`, `-15`
- Floating-point: `3.14`, `2.5e10`, `1.23E-4`
- Scientific notation supported with `e` or `E`

#### Strings
- Double-quoted: `"hello world"`
- Single-quoted: `'hello world'`
- Escape sequences: `\n`, `\t`, `\r`, `\\`, `\"`, `\'`

#### Booleans
- `true`
- `false`

### Identifiers
- Start with letter or underscore: `[a-zA-Z_]`
- Followed by letters, digits, or underscores: `[a-zA-Z0-9_]*`
- Examples: `variable`, `_private`, `data123`

### Action Paths
- Start with forward slash: `/`
- Path segments separated by `/`
- Characters allowed: `[a-zA-Z0-9_/-]+`
- Examples: `/my/action`, `/fetch/data`, `/process/user`

## Operators

### Arithmetic
- `+` Addition
- `-` Subtraction (binary and unary)
- `*` Multiplication
- `/` Division
- `%` Modulo

### Comparison
- `==` Equal
- `!=` Not equal
- `<` Less than
- `<=` Less than or equal
- `>` Greater than
- `>=` Greater than or equal

### Logical
- `not` Logical negation (unary)
- `and` Logical AND
- `or` Logical OR

### Assignment
- `=` Assignment

### Other
- `\` Lambda function prefix
- `->` Lambda arrow
- `[]` Array indexing
- `()` Function calls and grouping

## Operator Precedence (highest to lowest)

1. Primary expressions (literals, identifiers, parentheses)
2. Postfix (indexing `[]`, function calls `()`)
3. Unary (`not`, unary `-`)
4. Multiplicative (`*`, `/`, `%`)
5. Additive (`+`, `-`)
6. Comparison (`<`, `<=`, `>`, `>=`)
7. Equality (`==`, `!=`)
8. Logical AND (`and`)
9. Logical OR (`or`)

## Data Types

### Primitive Types
```dagular
42          // Number
"hello"     // String
true        // Boolean
false       // Boolean
```

### Collections

#### Arrays
```dagular
[1, 2, 3]
["a", "b", "c"]
[true, 42, "mixed"]
[]          // Empty array
```

#### Objects/Dictionaries
```dagular
{name: "John", age: 30}
{x: 10, y: 20}
{}          // Empty object
```

### Action References
```dagular
/my/action
/fetch/user/data
/process/payment
```

## Language Constructs

### Variable Declaration and Assignment

#### Let Declaration
```dagular
let x = 42
let name = "Alice"
let data = [1, 2, 3]
```

#### Bare Assignment
```dagular
x = 42
name = "Alice"
```

### Expressions

#### Arithmetic
```dagular
let result = (x + y) * 2
let remainder = count % 10
```

#### Logical
```dagular
let valid = age >= 18 and hasPermission
let invalid = not isValid or expired
```

#### Comparison
```dagular
let isEqual = x == y
let isGreater = score > threshold
```

### Control Flow

#### If-Else Expressions
```dagular
if condition {
    return "true branch"
} else {
    return "false branch"
}

// Nested conditionals
if x > 10 {
    if y > 5 {
        return "both conditions met"
    } else {
        return "only x > 10"
    }
} else {
    return "x <= 10"
}
```

#### Map Expressions
```dagular
map item in [1, 2, 3] {
    return item * 2
}

map user in users {
    return {name: user.name, adult: user.age >= 18}
}
```

### Function Definitions

#### Lambda Functions
```dagular
\x -> x * 2
\name -> "Hello, " + name
```

### Action Invocation
```dagular
/my/action(param1: "value", param2: 42)
/fetch/data(id: userId, format: "json")
/process/payment(amount: 100.50, currency: "USD")
```

### Array/Object Access
```dagular
array[0]
object["key"]
data[index]
user.profile["email"]  // Note: dot notation compiles to indexing
```

## Program Structure

### Single Expression Program
```dagular
42 + 10
```
*Compiles to a block with implicit return*

### Multi-Statement Program
```dagular
let x = 10
let y = 20
return x + y
```

### Complex Program
```dagular
let users = /fetch/users(active: true)
let processed = map user in users {
    if user.age >= 18 {
        return {
            name: user.name,
            status: "adult",
            discount: user.age >= 65
        }
    } else {
        return {
            name: user.name,
            status: "minor",
            discount: false
        }
    }
}
return processed
```

## AST Node Types

The compiler generates JSON AST with the following node structure:
```json
{
    "data": "node_type",
    "children": [...]
}
```

### Core Node Types
- `number` - Numeric literals
- `string` - String literals
- `id` - Identifiers and references
- `list` - Arrays
- `dict` - Objects/dictionaries
- `pair` - Key-value pairs in dictionaries
- `binop` - Binary operations
- `unop` - Unary operations
- `assign` - Variable assignments
- `return` - Return statements
- `block_expr` - Block expressions
- `if_expr` - Conditional expressions
- `map_expr` - Map expressions
- `lambda` - Lambda functions
- `invocation` - Action invocations
- `index` - Array/object indexing

## Syntax Rules

### Whitespace
- Whitespace is ignored except for token separation
- Newlines have no special meaning
- Indentation is not significant

### Semicolons
- Optional in most contexts
- Not required for statement termination

### Parentheses
- Required for function calls and grouping
- Optional for precedence control

### Braces
- Required for block expressions (`if`, `else`, `map`)
- Required for object literals

### Brackets
- Required for array literals and indexing

## Error Handling

The compiler provides detailed error messages including:
- Token position information
- Expected vs. actual token types
- Context-specific error descriptions

### Common Error Patterns
```dagular
// Missing closing brace
if x > 5 {
    return "missing brace"
// Error: Expected '}' after if body

// Invalid action call
my_action(param: value)
// Error: Actions must start with '/'

// Missing parameter name in action call
/action(: "value")
// Error: Expected parameter name
```

## Examples

### Basic Calculations
```dagular
let radius = 5
let area = 3.14159 * radius * radius
return area
```

### Data Processing
```dagular
let data = /fetch/sales(year: 2024)
let processed = map sale in data {
    let total = sale.quantity * sale.price
    let discount = if total > 1000 {
        return total * 0.1
    } else {
        return 0
    }
    return {
        id: sale.id,
        total: total,
        discount: discount,
        final: total - discount
    }
}
return processed
```

### Conditional Logic
```dagular
let user = /fetch/user(id: "123")
let access = if user.role == "admin" {
    return "full"
} else if user.role == "manager" {
    return "limited"
} else {
    return "none"
}
return {user: user.name, access: access}
```

### Lambda Functions
```dagular
let transform = \x -> x * 2 + 1
let numbers = [1, 2, 3, 4, 5]
let results = map n in numbers {
    return transform(n)
}
return results
```

## Integration Notes

- Compiles to JSON AST format compatible with DagularActions.scala
- Action paths must be valid system actions
- All expressions must eventually resolve to returnable values
- The AST preserves full semantic information for execution

## Language Philosophy

Dagular is designed to be:
- **Expressive**: Rich syntax for complex data transformations
- **Functional**: Emphasis on expressions over statements
- **Action-oriented**: First-class support for external action invocation
- **Type-flexible**: Dynamic typing with clear data structure support
- **Composable**: Easy to build complex programs from simple parts