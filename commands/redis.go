package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"time"

	"github.com/redis/go-redis/v9"
)

// silentLogger suppresses go-redis internal pool error messages.
type silentLogger struct{}

func (silentLogger) Printf(_ context.Context, _ string, _ ...interface{}) {}

const (
	DefaultRedisURL = "redis://localhost:6379/0"
	RedisEnvVar     = "DAGULAR_REDIS_URL"
	RedisKeyPrefix  = "dagular:schema:"
	redisTimeout    = 2 * time.Second
)

// getRedisURL resolves the Redis URL from flag, env var, or default.
func getRedisURL(flagValue string) string {
	if flagValue != "" {
		return flagValue
	}
	if envVal := os.Getenv(RedisEnvVar); envVal != "" {
		return envVal
	}
	return DefaultRedisURL
}

// newRedisClient creates a Redis client and verifies connectivity.
func newRedisClient(redisURL string) (*redis.Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Redis URL %q: %w", redisURL, err)
	}

	redis.SetLogger(silentLogger{})
	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), redisTimeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("cannot connect to Redis at %s: %w", redisURL, err)
	}

	return client, nil
}

// redisSetSchema stores a type schema for an action path.
func redisSetSchema(client *redis.Client, actionPath string, schemaJSON []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), redisTimeout)
	defer cancel()
	return client.Set(ctx, RedisKeyPrefix+actionPath, string(schemaJSON), 0).Err()
}

// redisGetSchema retrieves the type schema for a single action.
// Returns nil, nil if the key does not exist.
func redisGetSchema(client *redis.Client, actionPath string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), redisTimeout)
	defer cancel()

	val, err := client.Get(ctx, RedisKeyPrefix+actionPath).Result()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return []byte(val), nil
}

// redisDeleteSchema removes the type schema for an action path.
func redisDeleteSchema(client *redis.Client, actionPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), redisTimeout)
	defer cancel()
	return client.Del(ctx, RedisKeyPrefix+actionPath).Err()
}

// redisListSchemas returns all stored schemas as a map of actionPath → schemaJSON.
func redisListSchemas(client *redis.Client) (map[string][]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result := make(map[string][]byte)
	iter := client.Scan(ctx, 0, RedisKeyPrefix+"*", 100).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()
		val, err := client.Get(ctx, key).Result()
		if err != nil {
			continue
		}
		actionPath := key[len(RedisKeyPrefix):]
		result[actionPath] = []byte(val)
	}
	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("scanning Redis keys: %w", err)
	}

	return result, nil
}

// redisGetMultipleSchemas queries Redis for multiple action paths and assembles
// a combined JSON object in the same format as action-schema.json.
// Returns nil if no schemas were found.
func redisGetMultipleSchemas(client *redis.Client, actionPaths []string) ([]byte, error) {
	if len(actionPaths) == 0 {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), redisTimeout)
	defer cancel()

	// Pipeline GET for all keys
	pipe := client.Pipeline()
	cmds := make([]*redis.StringCmd, len(actionPaths))
	for i, path := range actionPaths {
		cmds[i] = pipe.Get(ctx, RedisKeyPrefix+path)
	}
	_, _ = pipe.Exec(ctx) // errors are per-key, handled below

	// Assemble results
	combined := make(map[string]json.RawMessage)
	for i, cmd := range cmds {
		val, err := cmd.Result()
		if err != nil {
			continue // key not found or error — skip
		}
		combined[actionPaths[i]] = json.RawMessage(val)
	}

	if len(combined) == 0 {
		return nil, nil
	}

	jsonBytes, err := json.Marshal(combined)
	if err != nil {
		return nil, fmt.Errorf("marshaling combined schemas: %w", err)
	}

	return jsonBytes, nil
}

// ---------- Deployment interception: extract & persist type signatures ----------

// ActionSignature represents the extracted type signature of an action.
type ActionSignature struct {
	Parameters map[string]map[string]interface{} `json:"parameters"`
	Returns    map[string]interface{}            `json:"returns,omitempty"`
}

// extractSignatureFromSource parses action source code for @param and @returns
// annotations. This works for any language because annotations live in comments.
//
// Supported formats (// or # style comments):
//
//	// @param name: string
//	// @param age: number
//	// @param active: boolean
//	// @returns: object
//
//	# @param name: string
//	# @returns: string
func extractSignatureFromSource(source string) *ActionSignature {
	// Strategy 1: annotation-based extraction (works for all languages)
	sig := extractAnnotationSignature(source)
	if sig != nil {
		return sig
	}

	// Strategy 2: Java code analysis (parse getAsString/getAsInt/etc. from source)
	sig = extractJavaSignature(source)
	if sig != nil {
		return sig
	}

	return nil
}

// extractAnnotationSignature looks for @param / @returns in comments.
func extractAnnotationSignature(source string) *ActionSignature {
	paramPattern := regexp.MustCompile(`(?://|#)\s*@param\s+(\w+)\s*:\s*(\w+)`)
	returnsPattern := regexp.MustCompile(`(?://|#)\s*@returns?\s*:\s*(\w+)`)

	sig := &ActionSignature{
		Parameters: make(map[string]map[string]interface{}),
	}

	for _, match := range paramPattern.FindAllStringSubmatch(source, -1) {
		paramName := match[1]
		paramType := normalizeType(match[2])
		sig.Parameters[paramName] = map[string]interface{}{
			"type":     paramType,
			"required": true,
		}
	}

	if match := returnsPattern.FindStringSubmatch(source); match != nil {
		sig.Returns = map[string]interface{}{
			"type": normalizeType(match[1]),
		}
	}

	if len(sig.Parameters) == 0 && sig.Returns == nil {
		return nil
	}

	return sig
}

// extractJavaSignature parses Java source code to extract type information
// directly from how the code reads parameters from the JsonObject.
//
// It recognizes these standard OpenWhisk Java patterns:
//
//	args.getAsJsonPrimitive("name").getAsString()   → name: string
//	args.getAsJsonPrimitive("count").getAsInt()      → count: number
//	args.getAsJsonPrimitive("count").getAsLong()     → count: number
//	args.getAsJsonPrimitive("price").getAsFloat()    → price: number
//	args.getAsJsonPrimitive("price").getAsDouble()   → price: number
//	args.getAsJsonPrimitive("active").getAsBoolean() → active: boolean
//	args.get("name").getAsString()                   → name: string
//	args.get("items").getAsJsonArray()               → items: array
//	args.get("config").getAsJsonObject()             → config: object
//	args.getAsJsonObject("config")                   → config: object
//	args.getAsJsonArray("items")                     → items: array
//	args.has("name")                                 → name: (detected, type unknown)
func extractJavaSignature(source string) *ActionSignature {
	// Quick check: is this Java code?
	if !regexp.MustCompile(`(?:public\s+(?:static\s+)?(?:JsonObject|class)|import\s+com\.google\.gson)`).MatchString(source) {
		return nil
	}

	sig := &ActionSignature{
		Parameters: make(map[string]map[string]interface{}),
	}

	// Pattern 1: args.getAsJsonPrimitive("name").getAsXxx() or args.get("name").getAsXxx()
	chainPattern := regexp.MustCompile(
		`\w+\.(?:getAsJsonPrimitive|get)\s*\(\s*"(\w+)"\s*\)\s*\.getAs(\w+)\s*\(`,
	)
	for _, match := range chainPattern.FindAllStringSubmatch(source, -1) {
		paramName := match[1]
		getter := match[2]
		paramType := javaGetterToType(getter)
		if paramType != "" {
			sig.Parameters[paramName] = map[string]interface{}{
				"type":     paramType,
				"required": true,
			}
		}
	}

	// Pattern 2: args.getAsJsonObject("name") — direct object access
	directObjPattern := regexp.MustCompile(`\w+\.getAsJsonObject\s*\(\s*"(\w+)"\s*\)`)
	for _, match := range directObjPattern.FindAllStringSubmatch(source, -1) {
		paramName := match[1]
		if _, exists := sig.Parameters[paramName]; !exists {
			sig.Parameters[paramName] = map[string]interface{}{
				"type":     "object",
				"required": true,
			}
		}
	}

	// Pattern 3: args.getAsJsonArray("name") — direct array access
	directArrPattern := regexp.MustCompile(`\w+\.getAsJsonArray\s*\(\s*"(\w+)"\s*\)`)
	for _, match := range directArrPattern.FindAllStringSubmatch(source, -1) {
		paramName := match[1]
		if _, exists := sig.Parameters[paramName]; !exists {
			sig.Parameters[paramName] = map[string]interface{}{
				"type":     "array",
				"required": true,
			}
		}
	}

	// Java OpenWhisk actions always return JsonObject
	sig.Returns = map[string]interface{}{
		"type": "object",
	}

	if len(sig.Parameters) == 0 {
		return nil
	}

	return sig
}

// javaGetterToType maps a Gson getter method name to a Dagular type.
func javaGetterToType(getter string) string {
	switch getter {
	case "String":
		return "string"
	case "Int", "Long", "Float", "Double", "Number", "Short", "BigDecimal":
		return "number"
	case "Boolean":
		return "boolean"
	case "JsonObject":
		return "object"
	case "JsonArray":
		return "array"
	default:
		return ""
	}
}

// normalizeType maps language-specific type names to Dagular's type system.
// e.g. "String" → "string", "int" → "number", "bool" → "boolean"
func normalizeType(raw string) string {
	switch raw {
	// String types
	case "string", "String", "str", "CharSequence":
		return "string"
	// Number types
	case "number", "int", "integer", "Integer", "long", "Long",
		"float", "Float", "double", "Double", "Number":
		return "number"
	// Boolean types
	case "boolean", "Boolean", "bool":
		return "boolean"
	// Object types
	case "object", "Object", "dict", "map", "Map", "JsonObject", "HashMap":
		return "object"
	// Array types
	case "array", "Array", "list", "List", "JsonArray":
		return "array"
	default:
		return raw
	}
}

// persistActionSignature extracts a type signature from action source code
// and stores it in Redis. Called after a successful wsk action create/update.
// Returns the number of parameters persisted, or 0 if no annotations found.
func persistActionSignature(actionName string, source string, redisURL string) (int, error) {
	sig := extractSignatureFromSource(source)
	if sig == nil {
		return 0, nil
	}

	actionPath := "/_/" + actionName

	schemaJSON, err := json.Marshal(sig)
	if err != nil {
		return 0, fmt.Errorf("marshaling signature: %w", err)
	}

	resolvedURL := getRedisURL(redisURL)
	client, err := newRedisClient(resolvedURL)
	if err != nil {
		return 0, err
	}
	defer client.Close()

	if err := redisSetSchema(client, actionPath, schemaJSON); err != nil {
		return 0, err
	}

	return len(sig.Parameters), nil
}
