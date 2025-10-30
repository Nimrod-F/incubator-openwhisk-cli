// Enhanced Dagular Compiler with Type Checking Integration
// This shows how to integrate the TypeChecker with the existing compiler

// Load the type checker
// const { TypeChecker } = require('./type_checker.js');

/**
 * Enhanced compiler that performs type checking during compilation
 */
class DagularCompilerWithTypes extends DagularCompiler {
  constructor(options = {}) {
    super();
    this.schemas = options.schemas || {};
    this.strictMode = options.strict || false;
    this.typeChecker = null;
  }

  /**
   * Compile with type checking
   * @param {string} source - The Dagular source code
   * @returns {object} - Compilation result with AST and type check results
   */
  compileWithTypeChecking(source) {
    // Step 1: Parse inline type declarations from source
    const typeDeclarations = this.extractTypeDeclarations(source);

    // Step 2: Regular compilation
    const ast = this.compile(source);

    // Step 3: Initialize type checker with schemas and declarations
    this.typeChecker = new TypeChecker(this.schemas, {
      strict: this.strictMode,
    });

    // Add inline declarations to type checker
    typeDeclarations.forEach((decl, actionPath) => {
      this.typeChecker.inlineDeclarations.set(actionPath, decl);
    });

    // Also parse type declarations from source
    this.typeChecker.parseTypeDeclarations(source);

    // Step 4: Perform type checking
    const typeCheckResult = this.typeChecker.checkAST(ast);

    // Step 5: Return combined result
    return {
      ast,
      typeCheck: {
        valid: typeCheckResult.valid,
        errors: typeCheckResult.errors,
        warnings: typeCheckResult.warnings,
        strictMode: this.strictMode,
      },
    };
  }

  /**
   * Extract type declarations from source code
   * Supports: declare actionName: (param: type, ...) => returnType
   */
  extractTypeDeclarations(source) {
    const declarations = new Map();
    const lines = source.split("\n");

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();

      // Check for strict mode directive
      if (trimmed === "#strict") {
        this.strictMode = true;
      }

      // Match: declare actionName: (param: type, ...) => returnType
      const match = trimmed.match(
        /^declare\s+(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*(\w+)/
      );
      if (match) {
        const [, actionName, paramsStr, returnType] = match;
        const actionPath = `/_/${actionName}`;

        // Parse parameters
        const parameters = {};
        if (paramsStr.trim()) {
          paramsStr.split(",").forEach((param) => {
            const paramMatch = param.trim().match(/(\w+)(\?)?\s*:\s*(\w+)/);
            if (paramMatch) {
              const [, paramName, optional, paramType] = paramMatch;
              parameters[paramName] = {
                type: paramType,
                required: !optional,
                line: lineNum + 1,
              };
            }
          });
        }

        declarations.set(actionPath, {
          parameters,
          returns: { type: returnType },
          line: lineNum + 1,
        });
      }
    });

    return declarations;
  }

  /**
   * Format type checking errors for display
   */
  formatTypeErrors(errors) {
    return errors
      .map((error) => {
        switch (error.type) {
          case "type-mismatch":
            return (
              `Type Error: ${error.message}\n` +
              `  Action: ${error.actionPath}\n` +
              `  Parameter: ${error.paramName}\n` +
              `  Expected: ${error.expectedType}\n` +
              `  Actual: ${error.actualType}`
            );

          case "missing-parameter":
            return (
              `Missing Parameter: ${error.message}\n` +
              `  Action: ${error.actionPath}\n` +
              `  Parameter: ${error.paramName}\n` +
              `  Type: ${error.expectedType}`
            );

          case "no-schema":
            return (
              `No Schema: ${error.message}\n` + `  Action: ${error.actionPath}`
            );

          default:
            return error.message;
        }
      })
      .join("\n\n");
  }

  /**
   * Format warnings for display
   */
  formatWarnings(warnings) {
    return warnings
      .map((warning) => {
        return `Warning: ${warning.message}`;
      })
      .join("\n");
  }
}

/**
 * Convenience function to compile with type checking
 */
function compileWithTypes(source, schemas = {}, options = {}) {
  const compiler = new DagularCompilerWithTypes({
    schemas,
    strict: options.strict || false,
  });

  try {
    const result = compiler.compileWithTypeChecking(source);

    // Check if type checking failed
    if (!result.typeCheck.valid) {
      const errorMsg = compiler.formatTypeErrors(result.typeCheck.errors);
      throw new Error(`Type checking failed:\n\n${errorMsg}`);
    }

    // Show warnings if any
    if (result.typeCheck.warnings.length > 0) {
      const warningMsg = compiler.formatWarnings(result.typeCheck.warnings);
      console.warn(`\n${warningMsg}\n`);
    }

    // Return the AST
    return result.ast;
  } catch (error) {
    throw new Error(`Compilation failed: ${error.message}`);
  }
}

/**
 * Example usage in Go integration
 */
function exampleUsage() {
  // Example DAG source
  const dagSource = `
    #strict
    
    declare hello: (name: string) => string
    
    let userName: string = input["name"]
    let userAge: number = 25
    
    // This works
    greeting = hello(name: userName)
    
    // This would fail type check
    // badCall = hello(name: userAge)
    
    return greeting
  `;

  // Load schemas
  const schemas = {
    "/_/hello": {
      parameters: {
        name: { type: "string", required: true },
      },
      returns: { type: "string" },
    },
  };

  // Compile with type checking
  try {
    const ast = compileWithTypes(dagSource, schemas, { strict: true });
    console.log("✓ Compilation successful!");
    console.log("AST:", JSON.stringify(ast, null, 2));
  } catch (error) {
    console.error("✗ Compilation failed!");
    console.error(error.message);
  }
}

// Export for Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DagularCompilerWithTypes,
    compileWithTypes,
  };
}

// Example of how it would be called from Go (via goja)
/*

In dag.go:

func compileWithValidation(src []byte, schemas []byte) ([]byte, error) {
    vm := goja.New()
    
    // Load type checker
    typeCheckerJS, _ := ioutil.ReadFile("commands/dagular/type_checker.js")
    if _, err := vm.RunString(string(typeCheckerJS)); err != nil {
        return nil, fmt.Errorf("loading type checker: %w", err)
    }
    
    // Load compiler
    if _, err := vm.RunString(string(compilerJS)); err != nil {
        return nil, fmt.Errorf("loading compiler: %w", err)
    }
    
    // Load enhanced compiler
    enhancedCompilerJS, _ := ioutil.ReadFile("commands/dagular/compiler_with_types.js")
    if _, err := vm.RunString(string(enhancedCompilerJS)); err != nil {
        return nil, fmt.Errorf("loading enhanced compiler: %w", err)
    }
    
    // Parse schemas
    var schemasObj interface{}
    if schemas != nil {
        json.Unmarshal(schemas, &schemasObj)
    }
    
    // Get the compileWithTypes function
    compileFunc := vm.Get("compileWithTypes")
    compileFn, ok := goja.AssertFunction(compileFunc)
    if !ok {
        return nil, fmt.Errorf("compileWithTypes not found")
    }
    
    // Call with strict mode
    options := map[string]interface{}{"strict": true}
    result, err := compileFn(
        goja.Undefined(),
        vm.ToValue(string(src)),
        vm.ToValue(schemasObj),
        vm.ToValue(options)
    )
    
    if err != nil {
        return nil, fmt.Errorf("compilation failed: %w", err)
    }
    
    // Stringify the result
    jsonVal := vm.Get("JSON").ToObject(vm).Get("stringify")
    stringifyFn, _ := goja.AssertFunction(jsonVal)
    outVal, _ := stringifyFn(goja.Undefined(), result)
    
    return []byte(outVal.String()), nil
}

*/
