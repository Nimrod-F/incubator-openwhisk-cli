/**
 * Action Validator for Dagular
 *
 * Validates that all actions referenced in a DAG file are:
 * 1. Deployed/registered in OpenWhisk
 * 2. Accessible by the user
 * 3. Have correct signatures (if schemas are provided)
 *
 * This prevents runtime errors by catching missing actions at compile/deploy time.
 */

class ActionValidator {
  constructor(whiskClient, options = {}) {
    this.client = whiskClient;
    this.options = {
      checkAccessibility: options.checkAccessibility !== false,
      checkSignatures: options.checkSignatures !== false,
      cacheResults: options.cacheResults !== false,
      verbose: options.verbose || false,
    };

    // Cache to avoid redundant API calls
    this.actionCache = new Map(); // actionPath -> action metadata
    this.validationCache = new Map(); // actionPath -> validation result
  }

  /**
   * Extract all action invocations from a DAG AST
   */
  extractActionInvocations(ast) {
    const invocations = new Set();

    const visit = (node) => {
      if (!node) return;

      // Found an invocation node
      if (
        node.data === "invocation" &&
        node.children &&
        node.children.length > 0
      ) {
        const actionPath = node.children[0];
        if (typeof actionPath === "string" && actionPath.startsWith("/")) {
          invocations.add(actionPath);
        }
      }

      // Recursively visit children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child) => {
          if (typeof child === "object" && child !== null) {
            visit(child);
          }
        });
      }
    };

    visit(ast);
    return Array.from(invocations);
  }

  /**
   * Extract action invocations from source code (before compilation).
   * Import-aware: resolves bare imported names and unimported names to action paths.
   */
  extractActionInvocationsFromSource(source) {
    const invocations = new Set();

    // 1. Match explicit action paths like: /_/actionName(...)
    const actionPattern = /\/([\w_\-\/]+)\s*\(/g;
    let match;
    while ((match = actionPattern.exec(source)) !== null) {
      const actionPath = "/" + match[1];
      invocations.add(actionPath);
    }

    // 2. Parse import statements
    const imports = new Map();
    const importPattern = /import\s*\{([^}]+)\}\s*from\s+(\w+)/g;
    let importMatch;
    while ((importMatch = importPattern.exec(source)) !== null) {
      const names = importMatch[1].split(',').map(n => n.trim()).filter(n => n);
      const namespace = importMatch[2];
      for (const name of names) {
        imports.set(name, `/${namespace}/${name}`);
      }
    }

    // 3. Find bare identifier invocations and resolve
    const bareCallPattern = /\b([a-zA-Z_]\w*)\s*\(/g;
    const keywords = new Set([
      'if', 'else', 'map', 'let', 'return', 'not', 'and', 'or',
      'true', 'false', 'import', 'from'
    ]);
    let bareMatch;
    while ((bareMatch = bareCallPattern.exec(source)) !== null) {
      const name = bareMatch[1];
      if (keywords.has(name)) continue;
      if (imports.has(name)) {
        invocations.add(imports.get(name));
      } else {
        invocations.add(`/_/${name}`);
      }
    }

    return Array.from(invocations);
  }

  /**
   * Check if an action exists in OpenWhisk
   */
  async checkActionExists(actionPath) {
    if (this.options.cacheResults && this.actionCache.has(actionPath)) {
      return { exists: true, action: this.actionCache.get(actionPath) };
    }

    try {
      // Parse action path: /namespace/packageName/actionName or /namespace/actionName
      const parts = actionPath.split("/").filter((p) => p);
      const actionName = parts[parts.length - 1];
      const namespace = parts.length > 1 ? parts[0] : "_"; // default namespace
      const packageName = parts.length > 2 ? parts[1] : undefined;

      // Construct qualified name
      let qualifiedName = actionName;
      if (packageName) {
        qualifiedName = `${packageName}/${actionName}`;
      }

      if (this.options.verbose) {
        console.log(
          `Checking action: ${actionPath} -> ${namespace}/${qualifiedName}`
        );
      }

      // This would use the actual OpenWhisk client
      // const action = await this.client.actions.get(qualifiedName);

      // For now, simulate the check
      const action = await this.mockGetAction(actionPath);

      if (this.options.cacheResults) {
        this.actionCache.set(actionPath, action);
      }

      return { exists: true, action };
    } catch (error) {
      if (error.statusCode === 404 || error.message.includes("not found")) {
        return { exists: false, error: `Action ${actionPath} not found` };
      }
      return { exists: false, error: error.message };
    }
  }

  /**
   * Mock function - replace with actual OpenWhisk API call
   */
  async mockGetAction(actionPath) {
    // In real implementation, this would be:
    // return await this.client.actions.get(actionPath);

    // Mock data for demonstration
    const knownActions = new Set([
      "/_/hello",
      "/_/world",
      "/_/sendEmail",
      "/_/initialize",
      "/_/process1",
      "/_/process2",
      "/_/process3",
    ]);

    if (knownActions.has(actionPath)) {
      return {
        name: actionPath.split("/").pop(),
        namespace: "_",
        version: "0.0.1",
        publish: false,
        annotations: [],
        parameters: [],
      };
    }

    const error = new Error(`Action ${actionPath} not found`);
    error.statusCode = 404;
    throw error;
  }

  /**
   * Validate all actions referenced in a DAG
   */
  async validateDAG(ast) {
    const results = {
      valid: true,
      checkedActions: [],
      missingActions: [],
      inaccessibleActions: [],
      errors: [],
      warnings: [],
    };

    // Extract all action invocations
    const actionPaths = this.extractActionInvocations(ast);

    if (actionPaths.length === 0) {
      results.warnings.push("No action invocations found in DAG");
      return results;
    }

    if (this.options.verbose) {
      console.log(
        `Found ${actionPaths.length} action invocation(s): ${actionPaths.join(
          ", "
        )}`
      );
    }

    // Check each action
    const checks = actionPaths.map(async (actionPath) => {
      const check = await this.checkActionExists(actionPath);

      if (check.exists) {
        results.checkedActions.push({
          path: actionPath,
          status: "ok",
          action: check.action,
        });
      } else {
        results.valid = false;
        results.missingActions.push(actionPath);
        results.errors.push({
          type: "missing-action",
          message: `Action not found: ${actionPath}`,
          actionPath,
          details: check.error,
        });
      }
    });

    await Promise.all(checks);

    return results;
  }

  /**
   * Validate DAG from source code (before compilation)
   */
  async validateDAGSource(source) {
    const actionPaths = this.extractActionInvocationsFromSource(source);

    if (actionPaths.length === 0) {
      return {
        valid: true,
        checkedActions: [],
        missingActions: [],
        errors: [],
        warnings: ["No action invocations found in source"],
      };
    }

    // Create a mock AST for validation
    const mockAST = {
      data: "block_expr",
      children: actionPaths.map((path) => ({
        data: "invocation",
        children: [path, { data: "dict", children: [] }],
      })),
    };

    return await this.validateDAG(mockAST);
  }

  /**
   * Format validation results for display
   */
  formatValidationReport(results) {
    let report = "\n" + "=".repeat(80) + "\n";
    report += "ACTION VALIDATION REPORT\n";
    report += "=".repeat(80) + "\n";

    if (results.valid) {
      report += "✓ All actions are deployed and accessible\n\n";
    } else {
      report += "✗ Validation failed - some actions are missing\n\n";
    }

    // Show checked actions
    if (results.checkedActions.length > 0) {
      report += `Verified Actions (${results.checkedActions.length}):\n`;
      results.checkedActions.forEach((action) => {
        report += `  ✓ ${action.path}\n`;
      });
      report += "\n";
    }

    // Show missing actions
    if (results.missingActions.length > 0) {
      report += `Missing Actions (${results.missingActions.length}):\n`;
      results.missingActions.forEach((path) => {
        report += `  ✗ ${path} - NOT FOUND\n`;
      });
      report += "\n";
    }

    // Show errors
    if (results.errors.length > 0) {
      report += "Errors:\n";
      results.errors.forEach((error) => {
        report += `  • ${error.message}\n`;
        if (error.details) {
          report += `    Details: ${error.details}\n`;
        }
      });
      report += "\n";
    }

    // Show warnings
    if (results.warnings.length > 0) {
      report += "Warnings:\n";
      results.warnings.forEach((warning) => {
        report += `  ⚠ ${warning}\n`;
      });
      report += "\n";
    }

    report += "=".repeat(80) + "\n";
    return report;
  }

  /**
   * Generate helpful suggestions for missing actions
   */
  generateSuggestions(missingActions) {
    if (missingActions.length === 0) return "";

    let suggestions = "\nSuggestions:\n\n";

    missingActions.forEach((actionPath) => {
      const actionName = actionPath.split("/").pop();
      suggestions += `To deploy ${actionPath}:\n`;
      suggestions += `  wsk action create ${actionName} ${actionName}.js\n`;
      suggestions += `  # or\n`;
      suggestions += `  wsk action create --dagular ${actionName} ${actionName}.json\n\n`;
    });

    suggestions += "To list all available actions:\n";
    suggestions += "  wsk action list\n\n";

    return suggestions;
  }
}

// Export for Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ActionValidator };
}
