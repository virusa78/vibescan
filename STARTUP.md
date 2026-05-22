# VibeScan Startup Guide

## Fastest path

```bash
./run.sh
```

This starts Docker services and the Wasp app together.

## Manual path

```bash
docker compose up -d
cd wasp-app
PORT=3555 wasp start
```

## URLs

- Frontend: `http://<host-ip>:3000`
- Backend: `http://<host-ip>:3555`
- MinIO console: `http://localhost:9001`

## Stop

```bash
./run.sh --stop
```

## Related docs

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/EMAIL_SETUP.md`
