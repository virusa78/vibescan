#!/bin/bash
# VibeScan Start Script - Production Docker Setup
# Starts Docker services and frontend with proper IP configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== VibeScan Start Script ==="
echo ""

# Detect server IP address
echo "Detecting network configuration..."
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="192.168.1.15"
fi
echo "Server IP: $SERVER_IP"
echo ""

# Step 1: Stop all services
echo "Step 1: Stopping existing services..."

# Kill frontend processes
pkill -9 -f "next dev" 2>/dev/null || true

# Kill by ports (3000-3004)
for port in 3000 3001 3002 3003 3004; do
    pid=$(lsof -t -i :$port 2>/dev/null) || true
    if [ -n "$pid" ]; then
        echo "  Killing process on port $port: $pid"
        kill -9 $pid 2>/dev/null || true
    fi
done

sleep 2

# Step 2: Start Docker services
echo "Step 2: Starting Docker services..."
docker compose up -d

echo "Waiting for services to be healthy..."
sleep 10

# Check if services are running
if ! docker compose ps | grep -q "vibescan-api"; then
    echo "❌ Error: Docker services failed to start"
    echo "Check logs with: docker compose logs"
    exit 1
fi

echo "✅ Docker services started"
echo ""

# Step 3: Wait for backend API
echo "Step 3: Waiting for backend API..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Backend API is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Error: Backend API failed to start"
        echo "Check logs with: docker compose logs vibescan"
        exit 1
    fi
    sleep 1
done
echo ""

# Step 4: Configure frontend environment
echo "Step 4: Configuring frontend..."
mkdir -p vibescan-ui
cat > vibescan-ui/.env.local << EOF
# API Configuration
NEXT_PUBLIC_API_URL=http://${SERVER_IP}:3000
EOF
echo "✅ Frontend configured to use API at: http://${SERVER_IP}:3000"
echo ""

# Step 5: Start frontend
echo "Step 5: Starting frontend..."
cd vibescan-ui

# Clean build cache to avoid ENOENT errors
rm -rf .next

# Start frontend
npm run dev > /tmp/vibescan-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

# Detect which port frontend is using
echo "Waiting for frontend to start..."
FRONTEND_PORT=""
for i in {1..20}; do
    # Check ports 3001-3004
    for port in 3001 3002 3003 3004; do
        if curl -s http://localhost:$port > /dev/null 2>&1; then
            FRONTEND_PORT=$port
            echo "✅ Frontend is ready on port $port!"
            break 2
        fi
    done
    sleep 1
done

echo ""
echo "=== VibeScan is running ==="
echo ""
echo "🌐 Access URLs:"
echo "   Frontend:  http://${SERVER_IP}:${FRONTEND_PORT}"
echo "   Backend:   http://${SERVER_IP}:3000"
echo "   MinIO:     http://${SERVER_IP}:9001 (console)"
echo ""
echo "👤 Demo Login:"
echo "   Email:    arjun.mehta@finstack.io"
echo "   Password: password123"
echo ""
echo "📊 Other Demo Users:"
echo "   priya.sharma@devcraft.in (Starter)"
echo "   rafael.torres@securecorp.com (Enterprise)"
echo ""
echo "📝 Logs:"
echo "   Frontend: /tmp/vibescan-frontend.log"
echo "   Backend:  docker compose logs -f vibescan"
echo ""
echo "🛑 To stop: docker compose down"
echo ""

# Show recent frontend logs if there are errors
if [ -f /tmp/vibescan-frontend.log ]; then
    ERROR_COUNT=$(grep -i "error\|fail" /tmp/vibescan-frontend.log | wc -l)
    if [ $ERROR_COUNT -gt 0 ]; then
        echo "⚠️  Frontend has $ERROR_COUNT errors. Check logs with:"
        echo "    tail -f /tmp/vibescan-frontend.log"
    fi
fi

echo "✅ Ready to use!"
