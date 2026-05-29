package commands

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/fatih/color"
	"github.com/spf13/cobra"
)

var dagTypesCmd = &cobra.Command{
	Use:   "types",
	Short: "manage action type schemas in Redis",
}

var dagTypesRegisterCmd = &cobra.Command{
	Use:   "register ACTION_PATH",
	Short: "register a type schema for an action in Redis",
	Args:  cobra.ExactArgs(1),
	RunE:  runDagTypesRegister,
}

var dagTypesGetCmd = &cobra.Command{
	Use:   "get ACTION_PATH",
	Short: "get the type schema for an action from Redis",
	Args:  cobra.ExactArgs(1),
	RunE:  runDagTypesGet,
}

var dagTypesListCmd = &cobra.Command{
	Use:   "list",
	Short: "list all registered type schemas in Redis",
	RunE:  runDagTypesList,
}

var dagTypesDeleteCmd = &cobra.Command{
	Use:   "delete ACTION_PATH",
	Short: "delete a type schema from Redis",
	Args:  cobra.ExactArgs(1),
	RunE:  runDagTypesDelete,
}

var dagTypesImportCmd = &cobra.Command{
	Use:   "import FILE",
	Short: "import schemas from an action-schema.json file into Redis",
	Args:  cobra.ExactArgs(1),
	RunE:  runDagTypesImport,
}

var dagTypesExportCmd = &cobra.Command{
	Use:   "export",
	Short: "export all Redis schemas to action-schema.json format",
	RunE:  runDagTypesExport,
}

func initDagTypesCommands() {
	dagTypesRegisterCmd.Flags().String("json", "", "inline JSON schema (e.g. '{\"parameters\":{...}}')")
	dagTypesRegisterCmd.Flags().String("file", "", "path to a JSON file containing the schema")

	dagTypesExportCmd.Flags().StringP("output", "o", "", "write to file instead of stdout")

	dagTypesCmd.AddCommand(
		dagTypesRegisterCmd,
		dagTypesGetCmd,
		dagTypesListCmd,
		dagTypesDeleteCmd,
		dagTypesImportCmd,
		dagTypesExportCmd,
	)
}

func runDagTypesRegister(cmd *cobra.Command, args []string) error {
	actionPath := args[0]

	// Get schema JSON from --json flag, --file flag, or stdin
	var schemaBytes []byte
	jsonFlag, _ := cmd.Flags().GetString("json")
	fileFlag, _ := cmd.Flags().GetString("file")

	switch {
	case jsonFlag != "":
		schemaBytes = []byte(jsonFlag)
	case fileFlag != "":
		var err error
		schemaBytes, err = ioutil.ReadFile(fileFlag)
		if err != nil {
			return fmt.Errorf("reading schema file: %w", err)
		}
	default:
		return fmt.Errorf("provide a schema via --json or --file")
	}

	// Validate JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal(schemaBytes, &parsed); err != nil {
		return fmt.Errorf("invalid JSON schema: %w", err)
	}

	// Compact the JSON for storage
	compacted, err := json.Marshal(parsed)
	if err != nil {
		return fmt.Errorf("marshaling schema: %w", err)
	}

	flagVal, _ := cmd.Flags().GetString("redis-url")
	url := getRedisURL(flagVal)
	client, err := newRedisClient(url)
	if err != nil {
		return err
	}
	defer client.Close()

	if err := redisSetSchema(client, actionPath, compacted); err != nil {
		return fmt.Errorf("storing schema: %w", err)
	}

	fmt.Printf("%s Registered type schema for %s\n", color.GreenString("ok:"), actionPath)
	return nil
}

func runDagTypesGet(cmd *cobra.Command, args []string) error {
	actionPath := args[0]

	flagVal, _ := cmd.Flags().GetString("redis-url")
	url := getRedisURL(flagVal)
	client, err := newRedisClient(url)
	if err != nil {
		return err
	}
	defer client.Close()

	schema, err := redisGetSchema(client, actionPath)
	if err != nil {
		return fmt.Errorf("reading schema: %w", err)
	}
	if schema == nil {
		return fmt.Errorf("no schema found for %s", actionPath)
	}

	// Pretty-print
	var parsed interface{}
	json.Unmarshal(schema, &parsed)
	pretty, _ := json.MarshalIndent(parsed, "", "  ")
	fmt.Printf("%s:\n%s\n", actionPath, string(pretty))
	return nil
}

func runDagTypesList(cmd *cobra.Command, args []string) error {
	flagVal, _ := cmd.Flags().GetString("redis-url")
	url := getRedisURL(flagVal)
	client, err := newRedisClient(url)
	if err != nil {
		return err
	}
	defer client.Close()

	schemas, err := redisListSchemas(client)
	if err != nil {
		return err
	}

	if len(schemas) == 0 {
		fmt.Println("No type schemas registered in Redis")
		return nil
	}

	fmt.Printf("Registered type schemas (%d):\n", len(schemas))
	for actionPath := range schemas {
		fmt.Printf("  • %s\n", actionPath)
	}
	return nil
}

func runDagTypesDelete(cmd *cobra.Command, args []string) error {
	actionPath := args[0]

	flagVal, _ := cmd.Flags().GetString("redis-url")
	url := getRedisURL(flagVal)
	client, err := newRedisClient(url)
	if err != nil {
		return err
	}
	defer client.Close()

	if err := redisDeleteSchema(client, actionPath); err != nil {
		return fmt.Errorf("deleting schema: %w", err)
	}

	fmt.Printf("%s Deleted type schema for %s\n", color.GreenString("ok:"), actionPath)
	return nil
}

func runDagTypesImport(cmd *cobra.Command, args []string) error {
	filePath := args[0]

	data, err := ioutil.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("reading %s: %w", filePath, err)
	}

	var schemas map[string]json.RawMessage
	if err := json.Unmarshal(data, &schemas); err != nil {
		return fmt.Errorf("invalid JSON in %s: %w", filePath, err)
	}

	flagVal, _ := cmd.Flags().GetString("redis-url")
	url := getRedisURL(flagVal)
	client, err := newRedisClient(url)
	if err != nil {
		return err
	}
	defer client.Close()

	count := 0
	for actionPath, schemaJSON := range schemas {
		if err := redisSetSchema(client, actionPath, schemaJSON); err != nil {
			fmt.Fprintf(os.Stderr, "  warning: failed to import %s: %v\n", actionPath, err)
			continue
		}
		count++
	}

	fmt.Printf("%s Imported %d schema(s) from %s into Redis\n", color.GreenString("ok:"), count, filePath)
	return nil
}

func runDagTypesExport(cmd *cobra.Command, args []string) error {
	flagVal, _ := cmd.Flags().GetString("redis-url")
	url := getRedisURL(flagVal)
	client, err := newRedisClient(url)
	if err != nil {
		return err
	}
	defer client.Close()

	schemas, err := redisListSchemas(client)
	if err != nil {
		return err
	}

	if len(schemas) == 0 {
		fmt.Fprintln(os.Stderr, "No schemas to export")
		return nil
	}

	// Build combined map
	combined := make(map[string]json.RawMessage)
	for actionPath, schemaBytes := range schemas {
		combined[actionPath] = json.RawMessage(schemaBytes)
	}

	pretty, err := json.MarshalIndent(combined, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling export: %w", err)
	}

	outPath, _ := cmd.Flags().GetString("output")
	if outPath != "" {
		if err := os.WriteFile(outPath, pretty, 0644); err != nil {
			return fmt.Errorf("writing %s: %w", outPath, err)
		}
		fmt.Printf("%s Exported %d schema(s) to %s\n", color.GreenString("ok:"), len(schemas), outPath)
	} else {
		fmt.Println(string(pretty))
	}
	return nil
}
