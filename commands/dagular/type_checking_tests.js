#!/usr/bin/env node

/**
 * Test suite for Type Checking in Dagular
 *
 * This demonstrates how the type checking system knows that
 * "hello expects name: string" through different methods.
 */

// Mock the dependencies if running standalone
if (typeof DagularCompiler === "undefined") {
  console.log("Loading dependencies...");
  // In real usage, these would be loaded via require() or embedded
}

const testCases = [
  {
    name: "METHOD 1: Schema Registry - Valid Call",
    description: "Type info from action-schema.json",
    schema: {
      "/_/hello": {
        parameters: {
          name: { type: "string", required: true },
        },
        returns: { type: "string" },
      },
    },
    source: `
      let userName = "Alice"
      greeting = hello(name: userName)
      return greeting
    `,
    shouldPass: true,
    expectedOutput:
      "✓ Type check passed: userName (string) matches hello.name (string)",
  },

  {
    name: "METHOD 1: Schema Registry - Type Mismatch",
    description: "Passing number to string parameter",
    schema: {
      "/_/hello": {
        parameters: {
          name: { type: "string", required: true },
        },
      },
    },
    source: `
      let userAge = 25
      greeting = hello(name: userAge)
    `,
    shouldPass: false,
    expectedError: "Type mismatch: expected string, got number",
  },

  {
    name: "METHOD 2: Inline Declaration - Valid",
    description: "Type info from declare statement in DAG",
    schema: {},
    source: `
      declare hello: (name: string) => string
      
      let userName = "Bob"
      greeting = hello(name: userName)
      return greeting
    `,
    shouldPass: true,
    expectedOutput: "✓ Type check passed using inline declaration",
  },

  {
    name: "METHOD 2: Inline Declaration - Type Mismatch",
    description: "Inline declaration catches type error",
    schema: {},
    source: `
      declare hello: (name: string) => string
      
      let age = 30
      greeting = hello(name: age)
    `,
    shouldPass: false,
    expectedError: "Type mismatch: expected string (from inline), got number",
  },

  {
    name: "METHOD 3: Variable Type Annotation",
    description: "Explicit type on variable",
    schema: {
      "/_/hello": {
        parameters: {
          name: { type: "string", required: true },
        },
      },
    },
    source: `
      let userName: string = "Charlie"
      let userAge: number = 25
      
      greeting1 = hello(name: userName)  // OK
      // greeting2 = hello(name: userAge)  // Would fail
      
      return greeting1
    `,
    shouldPass: true,
    expectedOutput: "✓ Type annotations validated successfully",
  },

  {
    name: "METHOD 4: Type Inference from Literals",
    description: "Compiler infers types automatically",
    schema: {
      "/_/hello": {
        parameters: {
          name: { type: "string", required: true },
        },
      },
    },
    source: `
      let inferredString = "David"  // Inferred as string
      let inferredNumber = 42       // Inferred as number
      
      greeting = hello(name: inferredString)  // OK
      return greeting
    `,
    shouldPass: true,
    expectedOutput: "✓ Type inference worked correctly",
  },

  {
    name: "METHOD 4: Type Inference - Catches Error",
    description: "Inferred type mismatch",
    schema: {
      "/_/hello": {
        parameters: {
          name: { type: "string", required: true },
        },
      },
    },
    source: `
      let age = 25  // Inferred as number
      greeting = hello(name: age)  // Error!
    `,
    shouldPass: false,
    expectedError: "Type mismatch: inferred number, expected string",
  },

  {
    name: "COMPLEX: Multiple Sources Priority",
    description: "Inline declaration overrides schema",
    schema: {
      "/_/hello": {
        parameters: {
          name: { type: "number", required: true }, // Schema says number
        },
      },
    },
    source: `
      declare hello: (name: string) => string  // Inline says string
      
      let userName = "Eve"
      greeting = hello(name: userName)  // Uses inline (string)
      return greeting
    `,
    shouldPass: true,
    expectedOutput: "✓ Inline declaration took priority over schema",
  },

  {
    name: "STRICT MODE: Missing Required Parameter",
    description: "Strict mode catches missing params",
    schema: {
      "/_/sendEmail": {
        parameters: {
          to: { type: "string", required: true },
          subject: { type: "string", required: true },
          body: { type: "string", required: false },
        },
      },
    },
    source: `
      #strict
      
      result = sendEmail(to: "test@example.com")
      // Missing required 'subject' parameter!
    `,
    shouldPass: false,
    expectedError: "Missing required parameter 'subject'",
  },

  {
    name: "ADVANCED: Return Type Checking",
    description: "Check return types in chained calls",
    schema: {
      "/_/hello": {
        parameters: {
          name: { type: "string", required: true },
        },
        returns: { type: "string" },
      },
      "/_/world": {
        parameters: {
          msg: { type: "string", required: true },
        },
        returns: { type: "string" },
      },
    },
    source: `
      greeting = hello(name: "Frank")  // Returns string
      result = world(msg: greeting)    // Expects string - OK!
      return result
    `,
    shouldPass: true,
    expectedOutput: "✓ Return type propagation works correctly",
  },

  {
    name: "ADVANCED: Return Type Mismatch",
    description: "Detect type mismatch in chained calls",
    schema: {
      "/_/getAge": {
        parameters: {
          userId: { type: "string", required: true },
        },
        returns: { type: "number" },
      },
      "/_/hello": {
        parameters: {
          name: { type: "string", required: true },
        },
      },
    },
    source: `
      age = getAge(userId: "123")  // Returns number
      greeting = hello(name: age)  // Expects string - ERROR!
    `,
    shouldPass: false,
    expectedError:
      "Type mismatch: expected string, got number (from return type)",
  },
];

// Display test results
function displayTestResults() {
  console.log("\n" + "=".repeat(80));
  console.log("TYPE CHECKING TEST SUITE");
  console.log(
    "Demonstrating: 'How does the system know hello expects name: string?'"
  );
  console.log("=".repeat(80) + "\n");

  testCases.forEach((test, index) => {
    console.log(`\nTest ${index + 1}: ${test.name}`);
    console.log(`Description: ${test.description}`);
    console.log(`Should Pass: ${test.shouldPass ? "YES" : "NO"}`);
    console.log("\nSchema:");
    console.log(JSON.stringify(test.schema, null, 2));
    console.log("\nSource Code:");
    console.log(test.source);
    console.log("\nExpected:");
    if (test.shouldPass) {
      console.log(`  ${test.expectedOutput}`);
    } else {
      console.log(`  ✗ ${test.expectedError}`);
    }
    console.log("\n" + "-".repeat(80));
  });

  console.log("\n" + "=".repeat(80));
  console.log("KEY INSIGHTS:");
  console.log("=".repeat(80));
  console.log(`
1. SCHEMA REGISTRY (action-schema.json)
   - Centralized type definitions
   - The compiler reads: "/_/hello": { "parameters": { "name": { "type": "string" } } }
   - When it sees: hello(name: age)
   - It checks: age's type vs schema's expected type

2. INLINE DECLARATIONS
   - declare hello: (name: string) => string
   - Type info embedded in DAG file
   - Takes priority over schema

3. TYPE ANNOTATIONS
   - let userName: string = "Alice"
   - Explicit type declarations
   - Compiler tracks in symbol table

4. TYPE INFERENCE
   - let age = 25  // Automatically inferred as number
   - No annotation needed
   - Smart enough to catch mismatches

5. PRIORITY ORDER
   - Inline declarations (highest)
   - Schema registry
   - Type inference
   - Unknown/Any (lowest)

RESULT: The system ALWAYS knows what type is expected!
`);
  console.log("=".repeat(80) + "\n");
}

// Run tests
displayTestResults();

// Export for use in actual test runner
if (typeof module !== "undefined" && module.exports) {
  module.exports = { testCases };
}
