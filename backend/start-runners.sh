#!/bin/bash

echo "Starting CP MatchMaker Code Runners..."

# Ensure the temp directory exists
mkdir -p temp_executions

# Remove old containers if they exist
echo "Cleaning up old containers..."
docker rm -f cp-python-runner cp-cpp-runner 2>/dev/null || true

# Start Python Runner (with 512MB RAM and 1 CPU core limits as safety net)
echo "Starting Python Runner..."
docker run -d \
    --name cp-python-runner \
    --memory="512m" \
    --cpus="1.0" \
    --network none \
    -v "$(pwd)/temp_executions:/jobs" \
    python:3-slim \
    tail -f /dev/null

# Start C++ Runner (with 512MB RAM and 1 CPU core limits as safety net)
echo "Starting C++ Runner..."
docker run -d \
    --name cp-cpp-runner \
    --memory="512m" \
    --cpus="1.0" \
    --network none \
    -v "$(pwd)/temp_executions:/jobs" \
    gcc:latest \
    tail -f /dev/null

echo "Runners started successfully!"
docker ps | grep cp-
