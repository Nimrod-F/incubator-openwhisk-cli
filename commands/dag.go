package commands

import (
	"fmt"
	"io/ioutil"
	"os"

	"github.com/dop251/goja"
	"github.com/apache/openwhisk-cli/wski18n"
	"github.com/apache/openwhisk-client-go/whisk"
	"github.com/spf13/cobra"
)

import (
	_ "embed"
)

const (
	DAGULAR_KIND = "dagular"
)

//go:embed dagular/dagular_compiler.js
var compilerJS []byte

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

	// deploy flags
	dagDeployCmd.Flags().StringP("name", "n", "", wski18n.T("the name of the Dagular action"))
	dagDeployCmd.MarkFlagRequired("name")

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
	jsonBytes, err := compileWithGoja(src)
	if err != nil {
		return fmt.Errorf("compile error: %w", err)
	}
	outPath, _ := cmd.Flags().GetString("output")

    if outPath != "" {
        if err := os.WriteFile(outPath, jsonBytes, 0644); err != nil {
            return fmt.Errorf("failed to write %s: %w", outPath, err)
        }
       return nil
    }
	return nil
}

func runDagDeploy(cmd *cobra.Command, args []string) error {
	file := args[0]
	src, err := ioutil.ReadFile(file)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", file, err)
	}

	// 1) compile to JSON AST
	jsonBytes, err := compileWithGoja(src)
	if err != nil {
		return fmt.Errorf("compile error: %w", err)
	}

	// 2) build whisk.Action
	actionName, _ := cmd.Flags().GetString("name")
	action := &whisk.Action{
		Name: actionName,
		Exec: &whisk.Exec{
			Kind: DAGULAR_KIND,
		},
	}
	codeStr := string(jsonBytes)
	action.Exec.Code = &codeStr

	// 3) deploy via existing client
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



