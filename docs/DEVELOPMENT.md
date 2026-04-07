# VibeScan Development Guide

## Quick Start

### Option 1: Using the Start Script (Recommended)

The easiest way to start VibeScan:

```bash
./scripts/start.sh
```

This will:
1. Start all Docker services (PostgreSQL, Redis, MinIO, Backend API)
2. Configure the frontend with the correct server IP
3. Start the frontend development server
4. Display access URLs and demo credentials

### Option 2: Manual Start

**Start Docker services:**
```bash
docker compose up -d
```

**Start frontend:**
```bash
cd vibescan-ui
npm run dev
```

## Access URLs

After starting, you'll see output like:

```
🌐 Access URLs:
   Frontend:  http://192.168.1.15:3001
   Backend:   http://192.168.1.15:3000
   MinIO:     http://192.168.1.15:9001 (console)
```

**Use the Frontend URL** shown in your terminal (not localhost if accessing remotely).

## Demo Users

| Email | Plan | Password |
|-------|------|----------|
| arjun.mehta@finstack.io | Pro | password123 |
| priya.sharma@devcraft.in | Starter | password123 |
| rafael.torres@securecorp.com | Enterprise | password123 |

## Project Structure

```
vibescan/
├── src/                    # Backend source
│   ├── config/            # Configuration
│   ├── database/          # PostgreSQL migrations
│   ├── handlers/          # API route handlers
│   ├── middleware/        # Fastify middleware
│   ├── services/          # Business logic
│   ├── workers/           # Queue workers
│   └── index.ts           # Entry point
├── vibescan-ui/           # Frontend (Next.js 15)
│   ├── src/app/           # App Router pages
│   ├── src/components/    # React components
│   └── src/lib/           # Utilities & API client
├── scripts/               # Utility scripts
│   ├── start.sh          # Start script
│   └── fill-mock-data.ts # Mock data generator
└── deploy/kubernetes/     # K8s manifests
```

## Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| vibescan-api | 3000 | Backend API |
| vibescan-postgres | 5432 | PostgreSQL database |
| vibescan-redis | 6379 | Cache & queues |
| vibescan-minio | 9000 | S3-compatible storage |
| vibescan-minio | 9001 | MinIO console |

## Development Commands

### Backend
```bash
# Run migrations
npm run migrate

# Run tests
npm test

# Build
npm run build

# Start backend only (without Docker)
npx tsx src/index.ts
```

### Frontend
```bash
cd vibescan-ui

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run E2E tests
node e2e/menu-navigation.js
```

### Docker
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Restart specific service
docker compose restart vibescan

# Rebuild after code changes
docker compose up -d --build
```

## Database Management

### Run Migrations
```bash
npm run migrate
```

### Rollback Migration
```bash
npm run migrate:rollback
```

### View Database
```bash
# Connect to PostgreSQL
docker exec -it vibescan-postgres psql -U postgres -d vibescan

# From host
psql postgresql://postgres:postgres@localhost:5432/vibescan
```

### Generate Mock Data
```bash
npx tsx scripts/fill-mock-data.ts
```

This creates:
- 3 demo users with 6 months of scan history
- ~840 total scans across all users
- ~3000 vulnerabilities

## API Documentation

### Authentication Endpoints

**Register:**
```bash
POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "plan": "starter",
  "region": "US"
}
```

**Login:**
```bash
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Response
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

### Scan Endpoints

**Submit Scan:**
```bash
POST /scans
Authorization: Bearer <token>
{
  "type": "sbom_upload",
  "components": [...]
}
```

**List Scans:**
```bash
GET /scans?page=1&limit=10
Authorization: Bearer <token>
```

## Troubleshooting

### Frontend Shows "ERR_CONNECTION_REFUSED"

**Problem:** Frontend can't connect to backend API.

**Solution:**
1. Check backend is running: `curl http://localhost:3000/health`
2. Check `.env.local` has correct API URL: `cat vibescan-ui/.env.local`
3. Restart frontend: Kill the process and run `./scripts/start.sh`

### ENOENT Error in Frontend

**Problem:** Build cache corruption.

**Solution:**
```bash
cd vibescan-ui
rm -rf .next
npm run dev
```

### Docker Services Won't Start

**Problem:** Ports already in use.

**Solution:**
```bash
# Find and kill processes using ports 3000, 5432, 6379, 9000
lsof -ti :3000 | xargs kill -9
lsof -ti :5432 | xargs kill -9
lsof -ti :6379 | xargs kill -9
lsof -ti :9000 | xargs kill -9

# Restart Docker
docker compose down
docker compose up -d
```

### Database Connection Errors

**Problem:** Backend can't connect to PostgreSQL.

**Solution:**
```bash
# Check PostgreSQL is running
docker compose ps vibescan-postgres

# Check database logs
docker compose logs vibescan-postgres

# Restart backend after fixing DB
docker compose restart vibescan
```

### Frontend Running on Wrong Port

**Problem:** Port 3000 occupied, frontend on 3001+.

**Solution:**
```bash
# Use the start script which auto-detects the port
./scripts/start.sh

# Or manually check which port it's using
netstat -tlnp | grep node
```

## Remote Access Setup

When accessing VibeScan from a different machine:

1. **Server IP Detection:** The start script auto-detects your server's IP
2. **Firewall:** Ensure ports 3000 and the frontend port are open
3. **Access:** Use the server IP URL shown in the startup output, not localhost

Example:
```
✅ http://192.168.1.15:3001  (use this)
❌ http://localhost:3001      (won't work remotely)
```

## Monitoring & Logs

### Backend Logs
```bash
# Docker logs
docker compose logs -f vibescan

# Specific service
docker compose logs -f vibescan-postgres
docker compose logs -f vibescan-redis
```

### Frontend Logs
```bash
# If using start script
tail -f /tmp/vibescan-frontend.log

# Otherwise, logs are in terminal
```

### Health Checks
```bash
# Backend health
curl http://localhost:3000/health | jq '.'

# Expected response
{
  "status": "degraded",
  "services": {
    "database": "ok",
    "redis": "ok",
    "s3": "ok"
  }
}
```

## Testing

### Run E2E Tests
```bash
cd vibescan-ui
node e2e/menu-navigation.js
```

Tests create HTML snapshots in `e2e/screenshots/`.

### Run Unit Tests
```bash
npm test
npm run test:coverage
```

## Security Notes

- All API endpoints require authentication (JWT or API key)
- CORS configured to allow frontend origin
- Passwords hashed with bcrypt (10 rounds)
- API keys stored as bcrypt hashes
- Sensitive data encrypted at rest (pgcrypto)
- Rate limiting: 100 requests/minute per IP

## Performance

### Queue Configuration

| Queue | Workers | Priority |
|-------|---------|----------|
| free_scan | 20 | High |
| enterprise_scan | 3 | Medium |
| webhook_delivery | 10 | Low |
| report_generation | 5 | Low |

### Database Indexing

Key indexes on:
- scans.user_id, status, created_at
- scan_results.scan_id
- api_keys.user_id (is_active)
- webhooks.user_id (is_active)

## Production Deployment

See `deploy/kubernetes/` for Kubernetes manifests.

CI/CD pipelines in `.github/workflows/`:
- `ci.yml` - Full CI/CD
- `property-tests.yml` - Daily property tests
- `k8s-deploy.yml` - Kubernetes deployments

## Support

For issues or questions:
- Check logs: `docker compose logs -f`
- Review troubleshooting section above
- Check GitHub Issues
