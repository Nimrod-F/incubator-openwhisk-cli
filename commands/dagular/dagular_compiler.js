// Dagular DSL Compiler
// Converts natural Dagular code into JSON AST format expected by DagularActions.scala

class DagularCompiler {
  constructor() {
    this.tokens = [];
    this.current = 0;
    this.imports = new Map();        // functionName -> "/namespace/functionName"
    this.localVariables = new Set(); // tracks let/assignment/lambda/map variable names
  }

  // ─── Tokenizer ────────────────────────────────────────────────────────────────
  tokenize(source) {
    const tokenPatterns = [
      // Skip whitespace and comments
      { type: "WHITESPACE", regex: /^\s+/ },
      { type: "COMMENT", regex: /^\/\/.*/ },
      { type: "COMMENT", regex: /^\/\*[\s\S]*?\*\// },

      // Keywords (order matters - longer first)
      { type: "RETURN", regex: /^return\b/ },
      { type: "LET", regex: /^let\b/ },
      { type: "IF", regex: /^if\b/ },
      { type: "ELSE", regex: /^else\b/ },
      { type: "MAP", regex: /^map\b/ },
      { type: "IN", regex: /^in\b/ },
      { type: "TRUE", regex: /^true\b/ },
      { type: "FALSE", regex: /^false\b/ },
      { type: "NOT", regex: /^not\b/ },
      { type: "AND", regex: /^and\b/ },
      { type: "OR", regex: /^or\b/ },
      { type: "IMPORT", regex: /^import\b/ },

      // Literals
      { type: "NUMBER", regex: /^\d+(\.\d+)?([eE][+-]?\d+)?/ },
      { type: "STRING", regex: /^"([^"\\]|\\.)*"/ },
      { type: "STRING", regex: /^'([^'\\]|\\.)*'/ },

      // Action paths
      { type: "ACTION_PATH", regex: /^\/[a-zA-Z0-9_\/-]+/ },

      // Operators (longer first)
      { type: "LAMBDA", regex: /^\\/ },
      { type: "ARROW", regex: /^->/ },
      { type: "EQ", regex: /^==/ },
      { type: "NE", regex: /^!=/ },
      { type: "LE", regex: /^<=/ },
      { type: "GE", regex: /^>=/ },
      { type: "LT", regex: /^</ },
      { type: "GT", regex: /^>/ },
      { type: "ASSIGN", regex: /^=/ },
      { type: "PLUS", regex: /^\+/ },
      { type: "MINUS", regex: /^-/ },
      { type: "MULT", regex: /^\*/ },
      { type: "DIV", regex: /^\// },
      { type: "MOD", regex: /^%/ },

      // Delimiters
      { type: "LPAREN", regex: /^\(/ },
      { type: "RPAREN", regex: /^\)/ },
      { type: "LBRACE", regex: /^\{/ },
      { type: "RBRACE", regex: /^\}/ },
      { type: "LBRACKET", regex: /^\[/ },
      { type: "RBRACKET", regex: /^\]/ },
      { type: "COMMA", regex: /^,/ },
      { type: "COLON", regex: /^:/ },
      { type: "SEMICOLON", regex: /^;/ },
      { type: "DOT", regex: /^\./ },

      // Identifiers (last)
      { type: "IDENTIFIER", regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
    ];

    this.tokens = [];
    let pos = 0;

    while (pos < source.length) {
      let matched = false;
      const remaining = source.slice(pos);

      for (const pattern of tokenPatterns) {
        const match = remaining.match(pattern.regex);
        if (match) {
          // Skip whitespace and comments
          if (pattern.type !== "WHITESPACE" && pattern.type !== "COMMENT") {
            this.tokens.push({
              type: pattern.type,
              value: match[0],
              pos: pos,
            });
          }
          pos += match[0].length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        throw new Error(
          `Unexpected character '${source[pos]}' at position ${pos}`
        );
      }
    }

    return this.tokens;
  }

  // ─── Parser Utilities ────────────────────────────────────────────────────────
  peek() {
    return this.tokens[this.current] || { type: "EOF", value: "" };
  }

  advance() {
    if (this.current < this.tokens.length) {
      return this.tokens[this.current++];
    }
    return { type: "EOF", value: "" };
  }

  check(type) {
    return this.peek().type === type;
  }

  match(...types) {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  consume(type, message) {
    if (this.check(type)) {
      return this.advance();
    }
    const current = this.peek();
    throw new Error(
      `${message}. Expected ${type}, got ${current.type} ('${current.value}')`
    );
  }

  isAtEnd() {
    return this.current >= this.tokens.length;
  }

  previous() {
    return this.tokens[this.current - 1];
  }

  // Create AST node in the format expected by Scala code
  createNode(data, children = []) {
    return {
      data: data,
      children: children,
    };
  }

  // ─── Import System ──────────────────────────────────────────────────────────

  // Parse a single import statement: import {name1, name2} from namespace
  parseImportStatement() {
    this.consume("IMPORT", "Expected 'import'");
    this.consume("LBRACE", "Expected '{' after 'import'");

    const names = [];
    if (!this.check("RBRACE")) {
      do {
        const name = this.consume("IDENTIFIER", "Expected function name in import");
        names.push(name.value);
      } while (this.match("COMMA"));
    }

    this.consume("RBRACE", "Expected '}' after import names");

    // 'from' is consumed contextually as an IDENTIFIER (not a keyword)
    const fromToken = this.consume("IDENTIFIER", "Expected 'from' after import list");
    if (fromToken.value !== "from") {
      throw new Error(`Expected 'from', got '${fromToken.value}'`);
    }

    const namespace = this.consume("IDENTIFIER", "Expected namespace after 'from'");
    return { names, namespace: namespace.value };
  }

  // Consume all top-level import statements and populate this.imports
  processImports() {
    this.imports = new Map();

    while (!this.isAtEnd() && this.check("IMPORT")) {
      const importData = this.parseImportStatement();

      for (const name of importData.names) {
        if (this.imports.has(name)) {
          throw new Error(
            `Duplicate import: '${name}' is already imported as '${this.imports.get(name)}'`
          );
        }
        this.imports.set(name, `/${importData.namespace}/${name}`);
      }
    }
  }

  // ─── Main Compiler Entry Point ───────────────────────────────────────────────
  compile(source) {
    try {
      this.tokenize(source);
      this.current = 0;
      this.localVariables = new Set();

      if (this.tokens.length === 0) {
        // Empty program returns empty object
        return this.createNode("dict", []);
      }

      // Process import statements before parsing the program body
      this.processImports();

      if (this.isAtEnd()) {
        // File contained only imports and no program body
        return this.createNode("dict", []);
      }

      const ast = this.parseProgram();

      // ─── Common Subexpression Elimination (compile-time optimization) ──────────
      // Detect structurally-identical, pure subexpressions that occur more than
      // once within a block and hoist each into a single `let` binding, so the
      // runtime evaluates it once and shares the result. Built-in pure
      // expressions (arithmetic, unary, indexing) are always eligible; action
      // invocations are eligible only when the action is marked pure via a
      // `// @pure actionName` annotation in the source.
      this.cseCounter = 0;
      const pureActions = this.parsePureAnnotations(source);
      return this.applyCse(ast, pureActions);
    } catch (error) {
      throw new Error(`Compilation failed: ${error.message}`);
    }
  }

  // ─── Program Structure ───────────────────────────────────────────────────────
  parseProgram() {
    // A program is either a single expression or a block with assignments
    if (this.isBlockStart()) {
      return this.parseBlockExpressionWithOptimization();
    } else {
      // Check if we have multiple expressions (potential parallel invocations)
      const expressions = this.parseMultipleExpressions();
      if (expressions.length === 1) {
        // Single expression - execute as statement (no automatic return)
        return this.createExecutionBlock(expressions);
      } else {
        // Multiple expressions - optimize for parallel execution
        return this.optimizeParallelExecution(expressions);
      }
    }
  }

  isBlockStart() {
    // Check if this looks like a block (multiple statements)
    let lookahead = this.current;
    while (lookahead < this.tokens.length) {
      const token = this.tokens[lookahead];
      if (token.type === "LET" || token.type === "RETURN") {
        return true;
      }
      if (
        token.type === "IDENTIFIER" &&
        lookahead + 1 < this.tokens.length &&
        this.tokens[lookahead + 1].type === "ASSIGN"
      ) {
        return true;
      }
      lookahead++;
      // Only look ahead a reasonable amount
      if (lookahead - this.current > 10) break;
    }
    return false;
  }

  parseBlockExpression() {
    const statements = [];

    while (!this.isAtEnd()) {
      if (this.check("LET")) {
        statements.push(this.parseLetAssignment());
      } else if (
        this.check("IDENTIFIER") &&
        this.tokens[this.current + 1]?.type === "ASSIGN"
      ) {
        statements.push(this.parseBareAssignment());
      } else if (this.check("RETURN")) {
        statements.push(this.parseReturn());
        break; // return ends the block
      } else {
        // Parse expression as statement
        const expr = this.parseExpression();
        statements.push(expr);

        // Continue parsing if there are more tokens and no explicit return
        if (this.isAtEnd()) {
          break;
        }
      }
    }

    return this.createNode("block_expr", statements);
  }

  parseBlockExpressionWithOptimization() {
    // Use the regular block parsing, but keep the original behavior
    // The optimization happens in the program-level parsing
    return this.parseBlockExpression();
  }

  parseMultipleExpressions() {
    const expressions = [];

    while (!this.isAtEnd()) {
      try {
        const expr = this.parseExpression();
        expressions.push(expr);
        // If we've consumed all tokens, break
        if (this.isAtEnd()) break;
      } catch (error) {
        // If parsing fails, stop and return what we have
        break;
      }
    }

    return expressions;
  }

  parseConsecutiveInvocations() {
    const invocations = [];

    while (!this.isAtEnd() && this.isInvocationStart()) {
      const expr = this.parseExpression();
      if (this.isInvocation(expr)) {
        invocations.push(expr);
      } else {
        // Not an invocation, put it back and stop
        this.current--;
        break;
      }
    }

    return invocations;
  }

  isInvocationStart() {
    // Check if the current token sequence looks like the start of an invocation
    return (
      this.check("ACTION_PATH") ||
      (this.check("IDENTIFIER") &&
        this.tokens[this.current + 1]?.type === "LPAREN")
    );
  }

  isInvocation(expr) {
    // Check if an expression is an invocation
    return expr && expr.data === "invocation";
  }

  optimizeParallelExecution(expressions) {
    // Check if ALL expressions are invocations
    const allInvocations = expressions.every((expr) => this.isInvocation(expr));

    if (allInvocations && expressions.length > 1) {
      // All expressions are invocations - create parallel execution (no return)
      return this.createNode("block_expr", [
        this.createNode("list", expressions),
      ]);
    } else {
      // Mixed expressions or single expression - execute as statements
      return this.createExecutionBlock(expressions);
    }
  }

  createExecutionBlock(expressions) {
    // Create a block that executes statements without automatic returns
    const statements = [];

    for (const expr of expressions) {
      if (this.isInvocation(expr)) {
        // Function invocations become execution statements
        statements.push(expr);
      } else {
        // Non-invocations (like assignments) are added as-is
        statements.push(expr);
      }
    }

    // If we only have one statement and it's not an invocation, wrap it appropriately
    if (statements.length === 1 && !this.isInvocation(statements[0])) {
      return this.createNode("block_expr", statements);
    }

    return this.createNode("block_expr", statements);
  }

  parseLetAssignment() {
    this.consume("LET", "Expected 'let'");
    const name = this.consume("IDENTIFIER", "Expected variable name");
    this.localVariables.add(name.value);
    this.consume("ASSIGN", "Expected '='");
    const expr = this.parseExpression();

    return this.createNode("assign", [
      this.createNode("id", [name.value]),
      expr,
    ]);
  }

  parseBareAssignment() {
    const name = this.consume("IDENTIFIER", "Expected variable name");
    this.localVariables.add(name.value);
    this.consume("ASSIGN", "Expected '='");
    const expr = this.parseExpression();

    return this.createNode("assign", [
      this.createNode("id", [name.value]),
      expr,
    ]);
  }

  parseReturn() {
    this.consume("RETURN", "Expected 'return'");
    const expr = this.parseExpression();
    return this.createNode("return", [expr]);
  }

  // ─── Expression Parsing (Precedence Climbing) ────────────────────────────────
  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    let expr = this.parseLogicalAnd();

    while (this.match("OR")) {
      const right = this.parseLogicalAnd();
      expr = this.createNode("binop", [expr, "or", right]);
    }

    return expr;
  }

  parseLogicalAnd() {
    let expr = this.parseEquality();

    while (this.match("AND")) {
      const right = this.parseEquality();
      expr = this.createNode("binop", [expr, "and", right]);
    }

    return expr;
  }

  parseEquality() {
    let expr = this.parseComparison();

    while (this.match("EQ", "NE")) {
      const operator = this.previous().value;
      const right = this.parseComparison();
      expr = this.createNode("binop", [expr, operator, right]);
    }

    return expr;
  }

  parseComparison() {
    let expr = this.parseAddition();

    while (this.match("GT", "GE", "LT", "LE")) {
      const operator = this.previous().value;
      const right = this.parseAddition();
      expr = this.createNode("binop", [expr, operator, right]);
    }

    return expr;
  }

  parseAddition() {
    let expr = this.parseMultiplication();

    while (this.match("PLUS", "MINUS")) {
      const operator = this.previous().value;
      const right = this.parseMultiplication();
      expr = this.createNode("binop", [expr, operator, right]);
    }

    return expr;
  }

  parseMultiplication() {
    let expr = this.parseUnary();

    while (this.match("MULT", "DIV", "MOD")) {
      const operator = this.previous().value;
      const right = this.parseUnary();
      expr = this.createNode("binop", [expr, operator, right]);
    }

    return expr;
  }

  parseUnary() {
    if (this.match("NOT", "MINUS")) {
      const operator = this.previous();
      const operatorStr = operator.type === "NOT" ? "not" : "-";
      const right = this.parseUnary();
      return this.createNode("unop", [operatorStr, right]);
    }

    return this.parsePostfix();
  }

  // ─── Postfix (indexing & invocation & apply) ────────────────────────────────
  parsePostfix() {
    let expr = this.parsePrimary();

    while (true) {
      // 1) Indexing
      if (this.match("LBRACKET")) {
        const indexExpr = this.parseExpression();
        this.consume("RBRACKET", "Expected ']' after index");
        expr = this.createNode("index", [expr, indexExpr]);

        // 2) Generic invocation / apply with import resolution
      } else if (this.match("LPAREN")) {
        const argsNode = this.parseArguments();
        this.consume("RPAREN", "Expected ')' after arguments");

        if (
          expr.data === "id" &&
          typeof expr.children[0] === "string"
        ) {
          const name = expr.children[0];

          if (name.startsWith("/")) {
            // a) Explicit action path (e.g., /_/hello) → invocation
            expr = this.createNode("invocation", [name, argsNode]);

          } else if (this.imports.has(name)) {
            // b) Imported action name → resolve to imported path → invocation
            expr = this.createNode("invocation", [this.imports.get(name), argsNode]);

          } else if (this.localVariables.has(name)) {
            // c) Local variable (lambda, let binding) → apply (function call)
            if (argsNode.data === "list" && argsNode.children.length === 1) {
              expr = this.createNode("apply", [expr, argsNode.children[0]]);
            } else {
              expr = this.createNode("apply", [expr, argsNode]);
            }

          } else {
            // d) Bare unimported name → default namespace /_/name → invocation
            expr = this.createNode("invocation", [`/_/${name}`, argsNode]);
          }

        } else {
          // Complex expression (e.g., result of indexing) → apply
          if (argsNode.data === "list" && argsNode.children.length === 1) {
            expr = this.createNode("apply", [expr, argsNode.children[0]]);
          } else {
            expr = this.createNode("apply", [expr, argsNode]);
          }
        }

        // 3) Neither—stop
      } else {
        break;
      }
    }

    return expr;
  }

  parseArguments() {
    if (this.check("RPAREN")) {
      // no args → empty dict
      return this.createNode("dict", []);
    }

    const children = [];

    // if it looks like named args (ident COLON), keep your old logic:
    if (
      this.check("IDENTIFIER") &&
      this.tokens[this.current + 1]?.type === "COLON"
    ) {
      // existing named‐pairs loop
      do {
        const key = this.consume("IDENTIFIER", "Expected parameter name");
        this.consume("COLON", "Expected ':' after parameter name");
        const value = this.parseExpression();
        children.push(
          this.createNode("pair", [this.createNode("id", [key.value]), value])
        );
      } while (this.match("COMMA"));
      return this.createNode("dict", children);
    }

    // otherwise, positional arguments — collect expressions:
    do {
      children.push(this.parseExpression());
    } while (this.match("COMMA"));

    // represent as a special “args” node (or reuse list):
    return this.createNode("list", children);
  }

  parsePrimary() {
    // Boolean literals
    if (this.match("TRUE")) {
      return this.createNode("id", ["true"]);
    }

    if (this.match("FALSE")) {
      return this.createNode("id", ["false"]);
    }

    // Numbers
    if (this.match("NUMBER")) {
      const value = parseFloat(this.previous().value);
      return this.createNode("number", [value]);
    }

    // Strings
    if (this.match("STRING")) {
      const raw = this.previous().value;
      // Remove quotes and handle escape sequences
      const value = raw.slice(1, -1).replace(/\\(.)/g, (_, char) => {
        switch (char) {
          case "n":
            return "\n";
          case "t":
            return "\t";
          case "r":
            return "\r";
          case "\\":
            return "\\";
          case '"':
            return '"';
          case "'":
            return "'";
          default:
            return char;
        }
      });
      return this.createNode("string", [value]);
    }

    // Identifiers and action paths
    if (this.match("ACTION_PATH", "IDENTIFIER")) {
      return this.createNode("id", [this.previous().value]);
    }

    // Arrays
    if (this.match("LBRACKET")) {
      const elements = [];

      if (!this.check("RBRACKET")) {
        do {
          elements.push(this.parseExpression());
        } while (this.match("COMMA"));
      }

      this.consume("RBRACKET", "Expected ']' after array elements");
      return this.createNode("list", elements);
    }

    // Objects/Dictionaries
    if (this.match("LBRACE")) {
      const pairs = [];

      if (!this.check("RBRACE")) {
        do {
          const key = this.consume("IDENTIFIER", "Expected property name");
          this.consume("COLON", "Expected ':' after property name");
          const value = this.parseExpression();

          pairs.push(
            this.createNode("pair", [this.createNode("id", [key.value]), value])
          );
        } while (this.match("COMMA"));
      }

      this.consume("RBRACE", "Expected '}' after object properties");
      return this.createNode("dict", pairs);
    }

    // Parenthesized expressions
    if (this.match("LPAREN")) {
      const expr = this.parseExpression();
      this.consume("RPAREN", "Expected ')' after expression");
      return expr;
    }

    // Control structures
    if (this.check("IF")) {
      return this.parseIfExpression();
    }

    if (this.check("MAP")) {
      return this.parseMapExpression();
    }

    if (this.check("LAMBDA")) {
      return this.parseLambdaExpression();
    }

    throw new Error(
      `Unexpected token: ${this.peek().type} ('${this.peek().value}')`
    );
  }

  parseIfExpression() {
    this.consume("IF", "Expected 'if'");
    const condition = this.parseExpression();
    this.consume("LBRACE", "Expected '{' after if condition");
    const thenBranch = this.parseBlockExpression();
    this.consume("RBRACE", "Expected '}' after if body");

    let elseBranch = this.createNode("dict", []); // default empty else

    if (this.match("ELSE")) {
      this.consume("LBRACE", "Expected '{' after else");
      elseBranch = this.parseBlockExpression();
      this.consume("RBRACE", "Expected '}' after else body");
    }

    return this.createNode("if_expr", [condition, thenBranch, elseBranch]);
  }

  // ─── Flexible map‐body support ───────────────────────────────────────────────
  parseMapExpression() {
    this.consume("MAP", "Expected 'map'");
    const variable = this.consume("IDENTIFIER", "Expected variable name");
    this.localVariables.add(variable.value);
    this.consume("IN", "Expected 'in'");
    const iterable = this.parseExpression();

    let bodyNode;
    if (this.match("LBRACE")) {
      // { … } case
      bodyNode = this.parseBlockExpression();
      this.consume("RBRACE", "Expected '}' after map body");
    } else {
      // inline‐expr case: use the expr directly as body
      bodyNode = this.parseExpression();
    }

    return this.createNode("map_expr", [variable.value, iterable, bodyNode]);
  }

  parseLambdaExpression() {
    this.consume("LAMBDA", "Expected '\\'");
    const param = this.consume("IDENTIFIER", "Expected parameter name");
    this.localVariables.add(param.value);
    this.consume("ARROW", "Expected '->' after lambda parameter");
    const body = this.parseExpression();

    return this.createNode("lambda", [param.value, body]);
  }

  // ─── Common Subexpression Elimination (compile-time pass) ─────────────────────
  // Finds structurally-identical, pure subexpressions that occur more than once
  // within a block and hoists each into a single `let` binding. The existing
  // runtime evaluates a let-bound expression once and shares its Future, so this
  // is purely a compile-time rewrite and needs no runtime change.

  // Collect the set of pure action names from `@pure name1, name2` annotations
  // (written in comments, e.g. `// @pure getProfile, lookup`).
  parsePureAnnotations(source) {
    const pure = new Set();
    if (typeof source !== "string") return pure;
    const re = /@pure\s+([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)/g;
    let m;
    while ((m = re.exec(source)) !== null) {
      m[1].split(",").forEach((n) => {
        const t = n.trim();
        if (t) pure.add(t);
      });
    }
    return pure;
  }

  // Final segment of an action path: "/payments/charge" -> "charge".
  cseActionName(path) {
    const parts = String(path).split("/").filter((s) => s.length > 0);
    return parts.length > 0 ? parts[parts.length - 1] : String(path);
  }

  // Canonical structural key: identical structure -> identical key.
  cseStructuralKey(node) {
    if (node === null || node === undefined) return "n";
    if (typeof node !== "object") return "v:" + JSON.stringify(node);
    const kids = (node.children || []).map((c) => this.cseStructuralKey(c));
    return node.data + "[" + kids.join("|") + "]";
  }

  // Is the node pure (safe to compute once)? Action invocations are pure only
  // when their action name appears in pureActions.
  cseIsEligible(node, pureActions) {
    if (!node || typeof node !== "object" || !node.data) return false;
    switch (node.data) {
      case "number":
      case "string":
      case "id":
        return true;
      case "binop":
        return (
          this.cseIsEligible(node.children[0], pureActions) &&
          this.cseIsEligible(node.children[2], pureActions)
        );
      case "unop":
        return this.cseIsEligible(node.children[1], pureActions);
      case "index":
        return node.children.every((c) => this.cseIsEligible(c, pureActions));
      case "list":
        return node.children.every((c) => this.cseIsEligible(c, pureActions));
      case "pair":
        return this.cseIsEligible(node.children[1], pureActions);
      case "dict":
        return node.children.every((p) => this.cseIsEligible(p, pureActions));
      case "invocation": {
        const name = this.cseActionName(node.children[0]);
        if (!pureActions.has(name)) return false;
        return this.cseIsEligible(node.children[1], pureActions);
      }
      default:
        // if_expr, map_expr, lambda, apply, assign, return, block_expr: not eligible
        return false;
    }
  }

  // Is the node a composite worth hoisting (and pure)?
  cseIsCandidate(node, pureActions) {
    if (!node || typeof node !== "object") return false;
    if (
      node.data !== "binop" &&
      node.data !== "unop" &&
      node.data !== "index" &&
      node.data !== "invocation"
    ) {
      return false;
    }
    return this.cseIsEligible(node, pureActions);
  }

  // Collect candidate occurrences within a statement, without crossing scopes.
  cseCollect(node, stmtIndex, occ, pureActions) {
    if (!node || typeof node !== "object" || !Array.isArray(node.children)) return;
    if (
      node.data === "block_expr" ||
      node.data === "if_expr" ||
      node.data === "map_expr" ||
      node.data === "lambda"
    ) {
      return; // scope boundary: handled by its own CSE pass
    }
    if (this.cseIsCandidate(node, pureActions)) {
      const key = this.cseStructuralKey(node);
      const info = occ.get(key);
      if (info) {
        info.count += 1;
      } else {
        occ.set(key, { node: node, count: 1, firstStmtIndex: stmtIndex });
      }
    }
    for (const c of node.children) {
      this.cseCollect(c, stmtIndex, occ, pureActions);
    }
  }

  // Replace every occurrence of the keyed subexpression with a reference to
  // varName, without crossing scopes.
  cseReplace(node, key, varName) {
    if (!node || typeof node !== "object" || !Array.isArray(node.children)) return node;
    if (
      node.data === "block_expr" ||
      node.data === "if_expr" ||
      node.data === "map_expr" ||
      node.data === "lambda"
    ) {
      return node; // scope boundary
    }
    if (this.cseStructuralKey(node) === key) {
      return this.createNode("id", [varName]);
    }
    node.children = node.children.map((c) => this.cseReplace(c, key, varName));
    return node;
  }

  // Within-block CSE: repeatedly hoist the earliest duplicated candidate until
  // none remain. Each iteration eliminates one duplicated subexpression.
  cseBlock(blockNode, pureActions) {
    let guard = 0;
    while (guard++ < 1000) {
      const statements = blockNode.children;
      const occ = new Map();
      for (let i = 0; i < statements.length; i++) {
        this.cseCollect(statements[i], i, occ, pureActions);
      }
      let chosen = null;
      for (const [key, info] of occ) {
        if (info.count >= 2) {
          if (chosen === null || info.firstStmtIndex < chosen.info.firstStmtIndex) {
            chosen = { key: key, info: info };
          }
        }
      }
      if (!chosen) break;

      const varName = "_cse" + this.cseCounter++;
      const binding = this.createNode("assign", [
        this.createNode("id", [varName]),
        JSON.parse(JSON.stringify(chosen.info.node)), // deep clone the canonical expr
      ]);
      const idx = chosen.info.firstStmtIndex;
      const next = [];
      for (let i = 0; i < statements.length; i++) {
        if (i === idx) next.push(binding);
        next.push(this.cseReplace(statements[i], chosen.key, varName));
      }
      blockNode.children = next;
    }
    return blockNode;
  }

  // Recurse through the AST, applying within-block CSE to every block_expr.
  applyCse(node, pureActions) {
    if (!node || typeof node !== "object" || !Array.isArray(node.children)) return node;
    node.children = node.children.map((c) => this.applyCse(c, pureActions));
    if (node.data === "block_expr") {
      return this.cseBlock(node, pureActions);
    }
    return node;
  }
}

// Export for Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = { DagularCompiler };
}
