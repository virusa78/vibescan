# VibeScan Demo Credentials

## Demo Users

All demo accounts use different passwords as specified below:

### Pro User
- **Email:** `arjun.mehta@finstack.io`
- **Password:** `vs_demo_pro_2026`
- **Plan:** Pro
- **Quota:** 100 scans/month
- **Data:** 406 scans, 812 vulnerabilities

### Starter User
- **Email:** `priya.sharma@devcraft.in`
- **Password:** `vs_demo_starter_2026`
- **Plan:** Starter
- **Quota:** 50 scans/month
- **Region:** India (IN)
- **Data:** 127 scans, 254 vulnerabilities

### Enterprise User
- **Email:** `rafael.torres@securecorp.com`
- **Password:** `vs_demo_ent_2026`
- **Plan:** Enterprise
- **Quota:** 1000 scans/month
- **Data:** 298 scans, 596 vulnerabilities

## Access Information

- **Frontend:** http://192.168.1.15:3001
- **Backend API:** http://192.168.1.15:3000
- **MinIO Console:** http://192.168.1.15:9001

## Features Enabled

✅ User authentication (JWT + API keys)
✅ Real-time dashboard with metrics
✅ Vulnerability reports with delta analysis
✅ Scan history and status tracking
✅ GitHub integration (ready for setup)
✅ Settings page with user profile
✅ Regional pricing (50% off for IN/PK)
✅ Mock data (6 months of scan history)

## Common Issues

**Settings page shows loading:**
- Backend needs rebuild with /auth/me endpoint
- Run: `docker compose up -d --build vibescan`

**Login fails:**
- Ensure you're using the correct password for each user
- Passwords are unique per user (see above)

**Frontend can't connect to API:**
- Check .env.local has correct IP: `NEXT_PUBLIC_API_URL=http://192.168.1.15:3000`
- Backend must be running on port 3000

## To Restart Everything

```bash
cd /home/virus/vibescan
bash scripts/start.sh
```

## To Stop Everything

```bash
docker compose down
pkill -9 -f "next"
```
