#!/bin/bash
# Script to run all VibeScan tests
# Usage: ./scripts/run-tests.sh

set -e

echo "========================================"
echo "Running VibeScan Test Suite"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running"
    exit 1
fi

# Check if required services are running
echo "Checking required services..."
SERVICES_OK=true

if ! docker ps --format '{{.Names}}' | grep -q "^vibescan-postgres$"; then
    echo "Warning: PostgreSQL container not found. Starting..."
    docker compose up -d postgres
fi

if ! docker ps --format '{{.Names}}' | grep -q "^vibescan-redis$"; then
    echo "Warning: Redis container not found. Starting..."
    docker compose up -d redis
fi

if ! docker ps --format '{{.Names}}' | grep -q "^vibescan-minio$"; then
    echo "Warning: MinIO container not found. Starting..."
    docker compose up -d minio
fi

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 5

# Run tests
echo ""
echo "Running tests..."
echo ""

npm test

TEST_EXIT_CODE=$?

echo ""
echo "========================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "All tests passed!"
else
    echo "Tests failed with exit code: $TEST_EXIT_CODE"
fi
echo "========================================"

exit $TEST_EXIT_CODE
