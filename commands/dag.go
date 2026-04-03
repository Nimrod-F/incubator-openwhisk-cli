package commands

import (
	"fmt"
	"io/ioutil"
	"os"
	"regexp"
	"strings"

	"github.com/dop251/goja"
	"github.com/apache/openwhisk-cli/wski18n"
	"github.com/apache/openwhisk-client-go/whisk"
	"github.com/spf13/cobra"
	_ "embed"
)

const (
	DAGULAR_KIND = "dagular"
)

//go:embed dagular/dagular_compiler.js
var compilerJS []byte

//go:embed dagular/type_checker.js
var typeCheckerJS []byte

var dagCmd = &cobra.Command{
	Use:   "dag",
	Short: wski18n.T("work with Dagular workflows"),
}

var dagCompileCmd = &cobra.Command{
	Use:   "compile FILE",
	Short: wski18n.T("compile a .dag file into Dagular JSON"),
	Args:  cobra.ExactArgs(1),
	RunE:  runDagCompile,
}

var dagDeployCmd = &cobra.Command{
	Use:   "deploy FILE",
	Short: wski18n.T("compile a .dag file and deploy it as a Dagular action"),
	Args:  cobra.ExactArgs(1),
	PreRunE: SetupClientConfig,
	RunE:  runDagDeploy,
}

func init() {
	// compile flags
	dagCompileCmd.Flags().StringP("output", "o", "", wski18n.T("write JSON to this file (defaults to stdout)"))
	dagCompileCmd.Flags().Bool("validate-actions", false, wski18n.T("validate that all referenced actions exist"))
	dagCompileCmd.Flags().Bool("skip-type-check", false, wski18n.T("skip type checking (not recommended)"))
	dagCompileCmd.Flags().StringP("schemas", "s", "", wski18n.T("path to action-schema.json (auto-discovered if not specified)"))

	// deploy flags
	dagDeployCmd.Flags().StringP("name", "n", "", wski18n.T("the name of the Dagular action"))
	dagDeployCmd.MarkFlagRequired("name")
	dagDeployCmd.Flags().Bool("skip-validation", false, wski18n.T("skip action validation (not recommended)"))
	dagDeployCmd.Flags().Bool("skip-type-check", false, wski18n.T("skip type checking (not recommended)"))
	dagDeployCmd.Flags().Bool("verbose", false, wski18n.T("show detailed validation information"))
	dagDeployCmd.Flags().StringP("schemas", "s", "", wski18n.T("path to action-schema.json (auto-discovered if not specified)"))

	// register
	dagCmd.AddCommand(dagCompileCmd, dagDeployCmd)
	WskCmd.AddCommand(dagCmd)
}

func runDagCompile(cmd *cobra.Command, args []string) error {
	file := args[0]
	src, err := ioutil.ReadFile(file)
	if err != nil {
		return fmt.Errorf("reading %s: %w", file, err)
	}

	// Load type schemas (currently from file; future: runtime introspection, registries, etc.)
	schemasPath, _ := cmd.Flags().GetString("schemas")
	schemas, schemaSource, err := loadTypeSchemas(file, schemasPath)
	if err != nil {
		return err
	}

	// Type check before compilation (unless skipped)
	skipTypeCheck, _ := cmd.Flags().GetBool("skip-type-check")
	if !skipTypeCheck && schemas != nil {
		fmt.Fprintf(os.Stderr, "Type checking against: %s\n", schemaSource)

		typeCheckResult, err := performTypeChecking(string(src), schemas, false)
		if err != nil {
			return fmt.Errorf("type checking error: %w", err)
		}

		if !typeCheckResult.Valid {
			fmt.Fprintln(os.Stderr, "\n❌ Type checking failed")
			fmt.Fprintln(os.Stderr, "\nType errors:")
			for _, errMsg := range typeCheckResult.Errors {
				fmt.Fprintf(os.Stderr, "  • %s\n", errMsg)
			}
			fmt.Fprintln(os.Stderr, "\nFix the type errors above, or skip with: --skip-type-check")
			return fmt.Errorf("compilation aborted due to type errors")
		}

		fmt.Fprintln(os.Stderr, "✓ Type checking passed")

		if len(typeCheckResult.Warnings) > 0 {
			for _, warning := range typeCheckResult.Warnings {
				fmt.Fprintf(os.Stderr, "  ⚠ %s\n", warning)
			}
		}
	}

	// Compile to JSON AST
	jsonBytes, err := compileWithGoja(src)
	if err != nil {
		return fmt.Errorf("compile error: %w", err)
	}
	outPath, _ := cmd.Flags().GetString("output")

	if outPath != "" {
		if err := os.WriteFile(outPath, jsonBytes, 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", outPath, err)
		}
		fmt.Fprintf(os.Stderr, "Compiled successfully to %s\n", outPath)
	} else {
		// Print AST to stdout (status messages go to stderr so AST is pipe-friendly)
		fmt.Println(string(jsonBytes))
	}
	return nil
}

func runDagDeploy(cmd *cobra.Command, args []string) error {
	file := args[0]
	src, err := ioutil.ReadFile(file)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", file, err)
	}

	skipValidation, _ := cmd.Flags().GetBool("skip-validation")
	verbose, _ := cmd.Flags().GetBool("verbose")

	// Load type schemas (pluggable — currently from file)
	schemasPath, _ := cmd.Flags().GetString("schemas")
	schemas, schemaSource, err := loadTypeSchemas(file, schemasPath)
	if err != nil {
		return err
	}
	if schemas != nil && verbose {
		fmt.Printf("Using schema file: %s\n", schemaSource)
	} else if schemas == nil && verbose {
		fmt.Println("No schema file found (type checking disabled)")
	}

	// 1) Validate that referenced actions exist (unless skipped)
	if !skipValidation {
		if verbose {
			fmt.Println("Validating referenced actions...")
		}
		
		validationResult, err := validateReferencedActions(string(src), verbose)
		if err != nil {
			return fmt.Errorf("validation error: %w", err)
		}

		if !validationResult.Valid {
			fmt.Println("\n❌ Validation failed: Some referenced actions are not deployed")
			fmt.Println("\nMissing actions:")
			for _, action := range validationResult.MissingActions {
				fmt.Printf("  • %s\n", action)
			}
			fmt.Println("\nPlease deploy the missing actions first:")
			for _, action := range validationResult.MissingActions {
				actionName := getActionName(action)
				fmt.Printf("  wsk action create %s %s.js\n", actionName, actionName)
			}
			fmt.Println("\nOr skip validation with: --skip-validation (not recommended)")
			return fmt.Errorf("deployment aborted due to missing actions")
		}

		if verbose && validationResult.Valid {
			fmt.Printf("✓ All %d referenced action(s) validated successfully\n", len(validationResult.CheckedActions))
		}
	}

	// 2) Type checking with schemas (if available)
	skipTypeCheck, _ := cmd.Flags().GetBool("skip-type-check")
	if !skipTypeCheck && schemas != nil && len(schemas) > 0 {
		if verbose {
			fmt.Println("Performing type checking...")
		}
		
		typeCheckResult, err := performTypeChecking(string(src), schemas, verbose)
		if err != nil {
			return fmt.Errorf("type checking error: %w", err)
		}

		if !typeCheckResult.Valid {
			fmt.Println("\n❌ Type checking failed")
			fmt.Println("\nType errors:")
			for _, errMsg := range typeCheckResult.Errors {
				fmt.Printf("  • %s\n", errMsg)
			}
			fmt.Println("\nPlease fix the type mismatches above.")
			fmt.Println("Or skip type checking with: --skip-type-check (not recommended)")
			return fmt.Errorf("deployment aborted due to type errors")
		}

		if verbose && typeCheckResult.Valid {
			fmt.Println("✓ Type checking passed")
		}

		// Show warnings if any
		if len(typeCheckResult.Warnings) > 0 {
			fmt.Println("\n⚠️  Warnings:")
			for _, warning := range typeCheckResult.Warnings {
				fmt.Printf("  • %s\n", warning)
			}
			fmt.Println()
		}
	}

	// 3) compile to JSON AST
	jsonBytes, err := compileWithGoja(src)
	if err != nil {
		return fmt.Errorf("compile error: %w", err)
	}

	// 3) build whisk.Action
	actionName, _ := cmd.Flags().GetString("name")
	action := &whisk.Action{
		Name: actionName,
		Exec: &whisk.Exec{
			Kind: DAGULAR_KIND,
		},
	}
	codeStr := string(jsonBytes)
	action.Exec.Code = &codeStr

	// 4) deploy via existing client
	if _, _, err := Client.Actions.Insert(action, true); err != nil {
		return fmt.Errorf("failed to create Dagular action %s: %v", actionName, err)
	}

	printActionCreated(actionName)
	return nil
}

// compileWithGoja runs the embedded JS compiler via goja and returns the JSON AST.
func compileWithGoja(src []byte) ([]byte, error) {
    vm := goja.New()

    // 1) Load & execute the compiler code
    if _, err := vm.RunString(string(compilerJS)); err != nil {
        return nil, fmt.Errorf("loading JS compiler: %w", err)
    }

    // 2) Instantiate it with `new DagularCompiler()`
    ctorVal := vm.Get("DagularCompiler")            // raw goja.Value
    instVal, err := vm.New(ctorVal)                 // use that Value directly
    if err != nil {
        return nil, fmt.Errorf("instantiating DagularCompiler: %w", err)
    }
    compilerObj := instVal.ToObject(vm)

    // 3) Call compile(source)
    compileProp := compilerObj.Get("compile")
    compileFn, ok := goja.AssertFunction(compileProp)
    if !ok {
        return nil, fmt.Errorf("compile() method not found")
    }
    compiled, err := compileFn(compilerObj, vm.ToValue(string(src)))
    if err != nil {
        return nil, fmt.Errorf("JS compile error: %w", err)
    }

    // 4) JSON.stringify(result)
    jsonVal := vm.Get("JSON").ToObject(vm).Get("stringify")
    stringifyFn, ok := goja.AssertFunction(jsonVal)
    if !ok {
        return nil, fmt.Errorf("JSON.stringify not available")
    }
    outVal, err := stringifyFn(goja.Undefined(), compiled)
    if err != nil {
        return nil, fmt.Errorf("stringify error: %w", err)
    }

    return []byte(outVal.String()), nil
}

// ValidationResult holds the result of action validation
type ValidationResult struct {
	Valid           bool     `json:"valid"`
	CheckedActions  []string `json:"checkedActions"`
	MissingActions  []string `json:"missingActions"`
	Errors          []string `json:"errors"`
}

// validateReferencedActions checks if all actions referenced in the DAG source exist
func validateReferencedActions(source string, verbose bool) (*ValidationResult, error) {
	// Extract action invocations from source using regex
	actionPaths := extractActionInvocations(source)
	
	if len(actionPaths) == 0 {
		if verbose {
			fmt.Println("No action invocations found in DAG")
		}
		return &ValidationResult{Valid: true}, nil
	}

	if verbose {
		fmt.Printf("Found %d action invocation(s) to validate\n", len(actionPaths))
	}

	result := &ValidationResult{
		Valid:          true,
		CheckedActions: []string{},
		MissingActions: []string{},
		Errors:         []string{},
	}

	// Check each action
	for _, actionPath := range actionPaths {
		if verbose {
			fmt.Printf("  Checking %s... ", actionPath)
		}

		exists, err := checkActionExists(actionPath)
		if err != nil {
			if verbose {
				fmt.Printf("ERROR: %v\n", err)
			}
			result.Valid = false
			result.MissingActions = append(result.MissingActions, actionPath)
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", actionPath, err))
		} else if !exists {
			if verbose {
				fmt.Println("NOT FOUND")
			}
			result.Valid = false
			result.MissingActions = append(result.MissingActions, actionPath)
			result.Errors = append(result.Errors, fmt.Sprintf("%s: not found", actionPath))
		} else {
			if verbose {
				fmt.Println("OK")
			}
			result.CheckedActions = append(result.CheckedActions, actionPath)
		}
	}

	return result, nil
}

// extractActionInvocations finds all action invocations in source code,
// including bare function names resolved via import statements.
func extractActionInvocations(source string) []string {
	actionSet := make(map[string]bool)

	// 1. Extract explicit action paths (e.g., /_/hello(...) or /ns/action(...))
	actionPattern := regexp.MustCompile(`/([\w_\-/]+)\s*\(`)
	matches := actionPattern.FindAllStringSubmatch(source, -1)
	for _, match := range matches {
		if len(match) > 1 {
			actionPath := "/" + match[1]
			actionSet[actionPath] = true
		}
	}

	// 2. Parse import statements to build namespace map
	imports := parseImportStatements(source)

	// 3. Find bare identifier invocations (name(...)) and resolve via imports
	//    or default namespace /_/
	bareCallPattern := regexp.MustCompile(`\b([a-zA-Z_]\w*)\s*\(`)
	bareMatches := bareCallPattern.FindAllStringSubmatch(source, -1)
	keywords := map[string]bool{
		"if": true, "else": true, "map": true, "let": true,
		"return": true, "not": true, "and": true, "or": true,
		"true": true, "false": true, "import": true, "from": true,
	}
	for _, match := range bareMatches {
		if len(match) > 1 {
			name := match[1]
			if keywords[name] {
				continue
			}
			if ns, ok := imports[name]; ok {
				// Imported name -> resolve to imported namespace
				actionPath := "/" + ns + "/" + name
				actionSet[actionPath] = true
			} else {
				// Bare unimported name -> default namespace
				actionPath := "/_/" + name
				actionSet[actionPath] = true
			}
		}
	}

	// Convert map to slice
	actions := make([]string, 0, len(actionSet))
	for action := range actionSet {
		actions = append(actions, action)
	}

	return actions
}

// parseImportStatements extracts import mappings from source code.
// Parses lines matching: import {name1, name2} from namespace
func parseImportStatements(source string) map[string]string {
	imports := make(map[string]string)
	importPattern := regexp.MustCompile(`import\s*\{([^}]+)\}\s*from\s+(\w+)`)
	matches := importPattern.FindAllStringSubmatch(source, -1)

	for _, match := range matches {
		if len(match) > 2 {
			namesStr := match[1]
			namespace := match[2]
			names := strings.Split(namesStr, ",")
			for _, name := range names {
				trimmed := strings.TrimSpace(name)
				if trimmed != "" {
					imports[trimmed] = namespace
				}
			}
		}
	}

	return imports
}

// checkActionExists verifies if an action exists in OpenWhisk
func checkActionExists(actionPath string) (bool, error) {
	// Parse action path: /namespace/packageName/actionName or /_/actionName
	parts := strings.Split(strings.Trim(actionPath, "/"), "/")
	if len(parts) == 0 {
		return false, fmt.Errorf("invalid action path: %s", actionPath)
	}

	// Extract components
	var actionName string
	if len(parts) == 1 {
		// /_/actionName -> actionName in default namespace
		actionName = parts[0]
	} else if len(parts) == 2 {
		// /_/actionName or /namespace/actionName
		if parts[0] == "_" {
			actionName = parts[1]
		} else {
			// Assume it's namespace/action
			actionName = parts[1]
		}
	} else {
		// /namespace/package/action
		actionName = strings.Join(parts[1:], "/")
	}

	// Try to get the action
	_, _, err := Client.Actions.Get(actionName, false)
	if err != nil {
		// Check if it's a 404 error
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		// Other error (permissions, network, etc.)
		return false, err
	}

	return true, nil
}

// getActionName extracts the action name from a path
func getActionName(actionPath string) string {
	parts := strings.Split(strings.Trim(actionPath, "/"), "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return actionPath
}

// findSchemaFile searches for action-schema.json in multiple locations
func findSchemaFile(dagFilePath string, explicitPath string) string {
	// If explicit path provided, use it
	if explicitPath != "" {
		if _, err := os.Stat(explicitPath); err == nil {
			return explicitPath
		}
		// Explicit path provided but doesn't exist - return it anyway to give clear error
		return explicitPath
	}

	// Auto-discovery locations (in order of priority)
	locations := []string{
		// 1. Same directory as the DAG file
		"",
		// 2. actions/dag directory
		"actions/dag/action-schema.json",
		// 3. actions directory
		"actions/action-schema.json",
		// 4. Current directory
		"action-schema.json",
	}

	// Calculate path relative to DAG file
	if dagFilePath != "" {
		dagDir := ""
		lastSlash := strings.LastIndexAny(dagFilePath, "/\\")
		if lastSlash >= 0 {
			dagDir = dagFilePath[:lastSlash+1]
		}
		locations[0] = dagDir + "action-schema.json"
	}

	// Check each location
	for _, path := range locations {
		if path == "" {
			continue
		}
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	// Not found - return empty string
	return ""
}

// loadTypeSchemas resolves action type schemas from the available source.
// Currently loads from a JSON file (action-schema.json).
// Future sources can be added here: runtime introspection, central registry, etc.
// Returns (schemas bytes, source description, error).
func loadTypeSchemas(dagFilePath string, explicitPath string) ([]byte, string, error) {
	// Source 1: Schema file (current implementation)
	schemaFile := findSchemaFile(dagFilePath, explicitPath)

	if schemaFile != "" {
		if _, err := os.Stat(schemaFile); err == nil {
			schemas, err := ioutil.ReadFile(schemaFile)
			if err != nil {
				return nil, "", fmt.Errorf("failed to read schema file: %w", err)
			}
			return schemas, schemaFile, nil
		} else if explicitPath != "" {
			return nil, "", fmt.Errorf("schema file not found: %s", schemaFile)
		}
	}

	// Source 2: (future) Runtime introspection — query OpenWhisk for action metadata
	// Source 3: (future) Central type registry

	// No type source available
	return nil, "", nil
}

// TypeCheckResult holds the result of type checking
type TypeCheckResult struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors"`
	Warnings []string `json:"warnings"`
}

// performTypeChecking validates types using the TypeChecker
func performTypeChecking(source string, schemas []byte, verbose bool) (*TypeCheckResult, error) {
	vm := goja.New()

	// Load type checker
	if _, err := vm.RunString(string(typeCheckerJS)); err != nil {
		return nil, fmt.Errorf("loading type checker: %w", err)
	}

	// Load compiler (needed for AST parsing)
	if _, err := vm.RunString(string(compilerJS)); err != nil {
		return nil, fmt.Errorf("loading compiler: %w", err)
	}

	// Parse schemas - we need to parse it first
	schemasStr := string(schemas)
	
	// Create TypeChecker instance with schemas as JSON string
	typeCheckerCtor := vm.Get("TypeChecker")
	
	// Parse the schema JSON in JavaScript
	vm.Set("schemasJSON", schemasStr)
	schemasObjVal, err := vm.RunString("JSON.parse(schemasJSON)")
	if err != nil {
		return nil, fmt.Errorf("invalid schema JSON: %w", err)
	}

	typeCheckerInst, err := vm.New(typeCheckerCtor, schemasObjVal, vm.ToValue(map[string]interface{}{
		"strict": strings.Contains(source, "#strict"),
	}))
	if err != nil {
		return nil, fmt.Errorf("creating TypeChecker: %w", err)
	}
	typeCheckerObj := typeCheckerInst.ToObject(vm)

	// Compile source to AST
	compilerCtor := vm.Get("DagularCompiler")
	compilerInst, err := vm.New(compilerCtor)
	if err != nil {
		return nil, fmt.Errorf("creating compiler: %w", err)
	}
	compilerObj := compilerInst.ToObject(vm)

	compileFn, ok := goja.AssertFunction(compilerObj.Get("compile"))
	if !ok {
		return nil, fmt.Errorf("compile method not found")
	}

	ast, err := compileFn(compilerObj, vm.ToValue(source))
	if err != nil {
		return nil, fmt.Errorf("compilation failed: %w", err)
	}

	// Run type checking
	checkASTFn, ok := goja.AssertFunction(typeCheckerObj.Get("checkAST"))
	if !ok {
		return nil, fmt.Errorf("checkAST method not found")
	}

	result, err := checkASTFn(typeCheckerObj, ast)
	if err != nil {
		return nil, fmt.Errorf("type checking failed: %w", err)
	}

	// Extract result
	resultObj := result.ToObject(vm)
	valid := resultObj.Get("valid").ToBoolean()
	
	errorsVal := resultObj.Get("errors")
	var errors []string
	if errorsArr, ok := errorsVal.Export().([]interface{}); ok {
		for _, e := range errorsArr {
			if errMap, ok := e.(map[string]interface{}); ok {
				if msg, ok := errMap["message"].(string); ok {
					errors = append(errors, msg)
				}
			}
		}
	}

	warningsVal := resultObj.Get("warnings")
	var warnings []string
	if warningsArr, ok := warningsVal.Export().([]interface{}); ok {
		for _, w := range warningsArr {
			if warnMap, ok := w.(map[string]interface{}); ok {
				if msg, ok := warnMap["message"].(string); ok {
					warnings = append(warnings, msg)
				}
			}
		}
	}

	return &TypeCheckResult{
		Valid:    valid,
		Errors:   errors,
		Warnings: warnings,
	}, nil
}

