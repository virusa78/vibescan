#!/bin/bash
# Cleanup script for VibeScan - kills old processes and clears ports

set -e

echo "=== VibeScan Cleanup Script ==="
echo ""

# Find and kill old Node.js processes
echo "Finding old Node.js/tsx/Next.js processes..."

# Kill all tsx watch processes (backend)
OLD_TSX=$(pgrep -f "tsx watch src/index.ts" 2>/dev/null || true)
if [ -n "$OLD_TSX" ]; then
    echo "Killing tsx watch processes..."
    echo "$OLD_TSX" | xargs -r kill -9
fi

# Kill all next dev processes (frontend)
OLD_NEXT=$(pgrep -f "next dev" 2>/dev/null || true)
if [ -n "$OLD_NEXT" ]; then
    echo "Killing next dev processes..."
    echo "$OLD_NEXT" | xargs -r kill -9
fi

# Wait a moment for ports to be released
sleep 1

# Check which ports are in use
echo ""
echo "Checking ports..."
echo "Port 3000:" $(lsof -i :3000 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1 || echo "free")
echo "Port 3001:" $(lsof -i :3001 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1 || echo "free")
echo "Port 3002:" $(lsof -i :3002 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1 || echo "free")
echo "Port 3003:" $(lsof -i :3003 2>/dev/null | grep LISTEN | awk '{print $2}' | head -1 || echo "free")

echo ""
echo "Cleanup complete!"
