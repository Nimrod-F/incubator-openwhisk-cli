// Type Checker for Dagular with Gradual Typing
// Supports multiple type information sources with priority order

class TypeChecker {
  constructor(schemas = {}, options = {}) {
    this.schemas = schemas;
    this.symbolTable = new Map(); // variable -> type info
    this.inlineDeclarations = new Map(); // action -> type info from DAG file
    this.strictMode = options.strict || false;
    this.errors = [];
    this.warnings = [];
  }

  // ─── Type Information Sources (Priority Order) ─────────────────────────────

  /**
   * Priority 1: Inline type declarations in DAG file
   * Example: declare hello: (name: string) => string
   */
  getInlineDeclarationType(actionPath, paramName) {
    const declaration = this.inlineDeclarations.get(actionPath);
    if (declaration && declaration.parameters) {
      return declaration.parameters[paramName];
    }
    return null;
  }

  /**
   * Priority 2: Schema registry (action-schema.json)
   * This is where we get "hello expects name: string"
   */
  getSchemaType(actionPath, paramName) {
    const schema = this.schemas[actionPath];
    if (schema && schema.parameters) {
      return schema.parameters[paramName];
    }
    return null;
  }

  /**
   * Resolve parameter type using priority order
   */
  resolveParameterType(actionPath, paramName) {
    // Priority 1: Inline declarations
    let typeInfo = this.getInlineDeclarationType(actionPath, paramName);
    if (typeInfo) {
      return { ...typeInfo, source: "inline" };
    }

    // Priority 2: Schema registry
    typeInfo = this.getSchemaType(actionPath, paramName);
    if (typeInfo) {
      return { ...typeInfo, source: "schema" };
    }

    // Unknown type
    return { type: "any", required: false, source: "unknown" };
  }

  /**
   * Resolve return type of an action
   */
  resolveReturnType(actionPath) {
    // Check inline first
    const inlineDecl = this.inlineDeclarations.get(actionPath);
    if (inlineDecl && inlineDecl.returns) {
      return { ...inlineDecl.returns, source: "inline" };
    }

    // Check schema
    const schema = this.schemas[actionPath];
    if (schema && schema.returns) {
      return { ...schema.returns, source: "schema" };
    }

    return { type: "any", source: "unknown" };
  }

  // ─── Type Inference ──────────────────────────────────────────────────────────

  /**
   * Infer type from AST node
   */
  inferType(ast, context = {}) {
    if (!ast) return { type: "unknown" };

    switch (ast.data) {
      case "string":
        return { type: "string", literal: ast.children[0] };

      case "number":
        return { type: "number", literal: ast.children[0] };

      case "id": {
        const varName = ast.children[0];

        // Check for boolean literals
        if (varName === "true" || varName === "false") {
          return { type: "boolean", literal: varName === "true" };
        }

        // Check symbol table
        if (this.symbolTable.has(varName)) {
          return this.symbolTable.get(varName);
        }

        // Check context parameters (from function input)
        if (context[varName]) {
          return context[varName];
        }

        return { type: "unknown", name: varName };
      }

      case "list": {
        if (ast.children.length === 0) {
          return { type: "array", elementType: "unknown" };
        }
        // Infer element type from first element
        const firstElemType = this.inferType(ast.children[0], context);
        return { type: "array", elementType: firstElemType.type };
      }

      case "dict":
        return { type: "object" };

      case "invocation": {
        const actionPath = ast.children[0];
        return this.resolveReturnType(actionPath);
      }

      case "binop": {
        const left = this.inferType(ast.children[0], context);
        const right = this.inferType(ast.children[2], context);
        const operator = ast.children[1].children[0];

        // Arithmetic operators return number
        if (["+", "-", "*", "/", "%"].includes(operator)) {
          return { type: "number" };
        }

        // Comparison operators return boolean
        if (["==", "!=", "<", ">", "<=", ">="].includes(operator)) {
          return { type: "boolean" };
        }

        // Logical operators return boolean
        if (["and", "or"].includes(operator)) {
          return { type: "boolean" };
        }

        return { type: "unknown" };
      }

      case "unop": {
        const operator = ast.children[0].children[0];
        if (operator === "not") {
          return { type: "boolean" };
        }
        if (operator === "-") {
          return { type: "number" };
        }
        return { type: "unknown" };
      }

      case "if_expr": {
        // Infer from then/else branches
        const thenType = this.inferType(ast.children[1], context);
        const elseType = this.inferType(ast.children[2], context);

        // If both branches have same type, return that
        if (thenType.type === elseType.type) {
          return thenType;
        }

        return { type: "any" }; // Mixed types
      }

      case "lambda":
        return { type: "function" };

      case "block_expr": {
        // Return type of last expression or explicit return
        for (let i = ast.children.length - 1; i >= 0; i--) {
          const child = ast.children[i];
          if (child.data === "return") {
            return this.inferType(child.children[0], context);
          }
        }
        // No explicit return, check last expression
        if (ast.children.length > 0) {
          return this.inferType(ast.children[ast.children.length - 1], context);
        }
        return { type: "object" }; // Empty block returns empty object
      }

      default:
        return { type: "unknown" };
    }
  }

  // ─── Type Checking ────────────────────────────────────────────────────────────

  /**
   * Check if two types are compatible
   */
  isTypeCompatible(actualType, expectedType) {
    // Unknown types are always compatible in non-strict mode
    if (
      !this.strictMode &&
      (actualType.type === "unknown" || actualType.type === "any")
    ) {
      return true;
    }

    // Any is compatible with everything
    if (expectedType.type === "any") {
      return true;
    }

    // Exact match
    if (actualType.type === expectedType.type) {
      return true;
    }

    // Array compatibility (check element types)
    if (actualType.type === "array" && expectedType.type === "array") {
      if (!expectedType.elementType || expectedType.elementType === "any") {
        return true;
      }
      return actualType.elementType === expectedType.elementType;
    }

    return false;
  }

  /**
   * Validate an invocation node
   * THIS IS WHERE WE CHECK: "hello expects name: string"
   */
  validateInvocation(invocationNode, context = {}) {
    const actionPath = invocationNode.children[0];
    const argsNode = invocationNode.children[1];

    const errors = [];
    const warnings = [];

    // Get action schema/declaration
    const actionSchema =
      this.schemas[actionPath] || this.inlineDeclarations.get(actionPath);

    if (!actionSchema) {
      if (this.strictMode) {
        errors.push({
          type: "no-schema",
          message: `No type information found for action ${actionPath}`,
          actionPath,
        });
      } else {
        warnings.push({
          type: "no-schema",
          message: `No type information found for action ${actionPath}`,
          actionPath,
        });
      }
      return { valid: errors.length === 0, errors, warnings };
    }

    // Extract provided parameters
    const providedParams = new Map();
    if (argsNode.data === "dict") {
      argsNode.children.forEach((pair) => {
        if (pair.data === "pair") {
          const keyNode = pair.children[0];
          const valueNode = pair.children[1];
          if (keyNode.data === "id") {
            const paramName = keyNode.children[0];
            const paramType = this.inferType(valueNode, context);
            providedParams.set(paramName, { node: valueNode, type: paramType });
          }
        }
      });
    }

    // Check required parameters
    Object.entries(actionSchema.parameters || {}).forEach(
      ([paramName, paramSpec]) => {
        if (paramSpec.required && !providedParams.has(paramName)) {
          errors.push({
            type: "missing-parameter",
            message: `Missing required parameter '${paramName}' for action ${actionPath}`,
            actionPath,
            paramName,
            expectedType: paramSpec.type,
          });
        }
      }
    );

    // Check parameter types - THIS IS THE KEY PART!
    providedParams.forEach((provided, paramName) => {
      const expectedSpec = this.resolveParameterType(actionPath, paramName);

      if (expectedSpec.type === "any" || expectedSpec.source === "unknown") {
        // No type information available
        if (this.strictMode) {
          warnings.push({
            type: "unknown-parameter",
            message: `No type information for parameter '${paramName}' of action ${actionPath}`,
            actionPath,
            paramName,
          });
        }
        return;
      }

      // TYPE CHECKING HAPPENS HERE
      if (!this.isTypeCompatible(provided.type, expectedSpec)) {
        const message =
          `Type mismatch for parameter '${paramName}' in ${actionPath}: ` +
          `expected ${expectedSpec.type}, got ${provided.type.type}` +
          (expectedSpec.source ? ` (from ${expectedSpec.source})` : "");

        errors.push({
          type: "type-mismatch",
          message,
          actionPath,
          paramName,
          expectedType: expectedSpec.type,
          actualType: provided.type.type,
          source: expectedSpec.source,
        });
      }
    });

    // Check for unknown parameters
    providedParams.forEach((provided, paramName) => {
      const expectedSpec = this.resolveParameterType(actionPath, paramName);
      if (expectedSpec.source === "unknown") {
        warnings.push({
          type: "unknown-parameter",
          message: `Unknown parameter '${paramName}' for action ${actionPath}`,
          actionPath,
          paramName,
        });
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Check entire AST
   */
  checkAST(ast, context = {}) {
    this.errors = [];
    this.warnings = [];

    this.visitNodes(ast, (node) => {
      // Handle variable assignments - track types
      if (node.data === "assign" && node.children.length === 2) {
        const varName = node.children[0].children[0];
        const valueType = this.inferType(node.children[1], context);
        this.symbolTable.set(varName, valueType);
      }

      // Check invocations
      if (node.data === "invocation") {
        const validation = this.validateInvocation(node, context);
        this.errors.push(...validation.errors);
        this.warnings.push(...validation.warnings);
      }
    });

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Visit all nodes in AST
   */
  visitNodes(ast, callback) {
    if (!ast) return;

    callback(ast);

    if (ast.children && Array.isArray(ast.children)) {
      ast.children.forEach((child) => {
        if (typeof child === "object" && child !== null) {
          this.visitNodes(child, callback);
        }
      });
    }
  }

  // ─── Inline Type Declarations Parser ──────────────────────────────────────────

  /**
   * Parse type declarations from DAG source code
   * Example: declare hello: (name: string) => string
   */
  parseTypeDeclarations(source) {
    const lines = source.split("\n");

    lines.forEach((line) => {
      const trimmed = line.trim();

      // Match: declare actionName: (param: type, ...) => returnType
      const match = trimmed.match(
        /^declare\s+(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*(\w+)/
      );
      if (match) {
        const [, actionName, paramsStr, returnType] = match;
        const actionPath = `/_/${actionName}`;

        // Parse parameters
        const parameters = {};
        paramsStr.split(",").forEach((param) => {
          const paramMatch = param.trim().match(/(\w+)\??\s*:\s*(\w+)/);
          if (paramMatch) {
            const [, paramName, paramType] = paramMatch;
            const optional = param.includes("?");
            parameters[paramName] = {
              type: paramType,
              required: !optional,
            };
          }
        });

        this.inlineDeclarations.set(actionPath, {
          parameters,
          returns: { type: returnType },
        });
      }
    });
  }
}

// Export for use in compiler
if (typeof module !== "undefined" && module.exports) {
  module.exports = { TypeChecker };
}
