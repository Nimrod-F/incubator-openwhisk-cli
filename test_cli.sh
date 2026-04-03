#!/bin/bash

echo "=== Testing OpenWhisk CLI ==="
echo "Current date: $(date)"
echo ""

echo "=== Checking if OpenWhisk is running on port 3232 ==="
timeout 3 curl -s -w "\nHTTP Status: %{http_code}\n" http://localhost:3232/api/v1/namespaces 2>&1 || echo "Connection failed or timed out"
echo ""

echo "=== Setting CLI configuration ==="
./wsk property set --apihost http://localhost:3232 --auth 23bc46b1-71f6-4ed5-8c54-816aa4f8c502:123zO3xZCLrMN6v2BKK1dXYFpXlPkccOFqm12CdAsMgRU4VrNZ9lyGVCGuMDGIwPd
echo ""

echo "=== Getting CLI properties ==="
timeout 5 ./wsk property get
echo ""

echo "=== Listing actions ==="
timeout 5 ./wsk action list
echo ""

echo "=== Test complete ==="

