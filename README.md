# Cloud Network Management Dashboard — Backend Skeleton

This is a working FastAPI backend: JWT auth, role-based access control (admin/viewer),
device CRUD, an ICMP-based poller that already writes real reachability metrics and
pushes them over WebSocket, and an audit log on every mutating action. Postgres +
Redis run in Docker. The frontend isn't scaffolded yet — see "What's next" below.

## What's already working

- `POST /api/auth/login` / `POST /api/auth/refresh` — JWT auth
- `GET/POST/PATCH/DELETE /api/users` — admin-only user management
- `GET/POST/PATCH/DELETE /api/devices` — device CRUD (create/edit/delete = admin only, read = any logged-in user)
- `GET /api/devices/{id}/metrics` — historical metrics for a device
- `GET /api/audit-log` — admin-only audit trail
- `WS /api/ws/dashboard` — live push of status/metric updates as the poller runs
- Background poller: pings every device every 30s, records a `reachability` metric, broadcasts it — this is real, not mocked
- `GET /api/health` — container healthcheck

## Start today — step by step

1. **Install Docker Desktop** if you don't have it (docker.com) — that's the only prerequisite.

2. **Get the code running:**
   ```bash
   cd network-dashboard
   docker compose up --build
   ```
   Wait for `backend` logs to show `Application startup complete`.

3. **Create the migration for the schema** (only needed once, since no migrations exist yet):
   ```bash
   docker compose exec backend alembic revision --autogenerate -m "initial schema"
   docker compose exec backend alembic upgrade head
   ```

4. **Create your first admin user:**
   ```bash
   docker compose exec backend python -m app.seed
   ```
   This prints a username/password (`admin` / `ChangeMe123!`). Log in with it.

5. **Open the interactive API docs** at `http://localhost:8000/docs` — this is FastAPI's
   auto-generated Swagger UI. Use it to:
   - `POST /api/auth/login` with the admin credentials → copy the `access_token`
   - Click "Authorize" in the top right, paste the token
   - `POST /api/devices` — add a real device on your network (even your home router's IP works, e.g. `192.168.1.1`) — you don't need SNMP configured yet, ICMP ping alone will populate its status
   - `GET /api/devices` — see it come back with a status
   - Wait ~30s, then `GET /api/devices/{id}/metrics` — you'll see real reachability data points already being recorded

   This is the fastest way to confirm the whole pipeline (DB → poller → WebSocket) works
   before you write a single line of frontend code.

6. **Watch it live:** open `ws://localhost:8000/api/ws/dashboard` in a WebSocket test tool
   (e.g. the "WebSocket" tab in Postman, or `websocat ws://localhost:8000/api/ws/dashboard`)
   and watch status updates stream in every poll cycle.

If you do just steps 1-6 today, you'll have a real backend with a real device being
monitored — that's a genuinely working core, before any UI exists.

## What's next (in order)

1. **Scaffold the frontend**: `npm create vite@latest frontend -- --template react-ts`,
   add Tailwind + shadcn/ui, build the login page hitting `/api/auth/login`.
2. **Device list page**: call `GET /api/devices`, render cards with status badges.
3. **Wire the WebSocket**: subscribe to `/api/ws/dashboard`, update card status live.
4. **Device detail + charts**: `GET /api/devices/{id}/metrics`, render with Recharts.
5. **Extend the poller with real SNMP** (see `app/services/poller.py` — there's a TODO
   marking exactly where to add `pysnmp` GET calls for CPU/memory/interface counters
   once you're polling SNMP-enabled gear, not just doing ICMP reachability checks).
6. **Admin panel** for users + audit log, using the endpoints that already exist.

## Project layout

```
backend/
  app/
    core/       # config, JWT/password helpers, auth dependency + RBAC
    db/         # SQLAlchemy async engine/session, declarative base
    models/     # User, Device, Interface, Metric, AuditLog
    schemas/    # Pydantic request/response models
    api/routes/ # auth, users, devices, audit, websocket
    services/   # poller.py (background polling loop), audit_logger.py
    seed.py     # creates the first admin user
  alembic/      # DB migrations
docker-compose.yml
```

## Testing

Backend (pytest, against a real Postgres test database — not mocks):
```bash
cd backend
pip install -r requirements.txt
export TEST_DATABASE_URL=postgresql+asyncpg://netdash:netdash@localhost:5432/netdash_test
# create netdash_test once: psql -c "CREATE DATABASE netdash_test OWNER netdash;"
alembic upgrade head  # against netdash_test, via DATABASE_URL env var
pytest -v
```
22 tests covering auth, RBAC enforcement, device CRUD, and audit logging — all run against a genuine Postgres instance, not sqlite or mocks, since the models use Postgres-specific types.

Frontend (vitest):
```bash
cd frontend
npm install
npm test
```

## CI/CD

`.github/workflows/ci.yml` runs both suites (plus a full production build) on every push and PR to `main` — backend tests spin up a real Postgres service container in the workflow itself.

## Alerting (optional)

Device status changes (online ↔ offline) can trigger real email and/or webhook notifications — see `backend/app/services/notifier.py` and the alerting section in `backend/.env.example`. Both are off by default; configure `SMTP_*` / `ALERT_EMAIL_TO` for email, or `ALERT_WEBHOOK_URL` (e.g. a Slack incoming webhook) for webhook alerts. Either, both, or neither — the poller never breaks if this isn't configured.

## Interface-level detail

For devices with SNMP configured, the poller now also collects per-interface data (name, up/down, speed) into the `Interface` table, exposed via `GET /api/devices/{id}/interfaces` and shown on the device detail page.

## Important: migrations

No new database migration is needed for any of the features above (interfaces, alerting, tests, CI) — the schema was already sufficient. **Don't replace your existing `alembic/versions` folder** if you already have a working migration from initial setup; only add new backend/frontend source files as instructed.

## Bandwidth monitoring

For devices with SNMP configured, the poller now computes real bandwidth (Mbps in/out) by comparing consecutive `ifInOctets`/`ifOutOctets` counter readings over time — not just interface up/down status. Handles 32-bit counter wraparound safely (skips that interval rather than reporting a bogus negative rate). Shown as trend charts on the device detail page. Note: if a device has multiple interfaces, the chart currently combines all of them into one series — true per-interface bandwidth breakdown isn't built yet.

## Security hardening (this pass)

Four real gaps got closed in this round, each with tests proving it:

- **WebSocket authentication** — `/api/ws/dashboard` now requires a valid JWT (passed as a query param, since browsers can't set custom headers on a WebSocket handshake) before accepting the connection. Previously anyone with the URL could watch live device data with no login at all.
- **CORS locked down** — `allow_origins` is no longer `"*"`; it's a configurable list (`CORS_ALLOWED_ORIGINS` in `.env`) defaulting to just the local dev frontend origin.
- **Credentials encrypted at rest** — `snmp_community` is now encrypted (via `cryptography`'s Fernet) before it's ever written to the database, and decrypted only in-memory when the poller actually needs it. Devices created before this change keep working via a graceful plaintext fallback in `decrypt_secret()` — see `app/core/security.py`.
- **Alert cooldown** — a flapping device (rapidly toggling online/offline) no longer spams your email/webhook on every single transition; `ALERT_COOLDOWN_SECONDS` (default 300s) throttles repeat alerts per device. The audit log and activity feed still record every real transition — only the *notification* is throttled.

**Still open, by design (not done in this pass):** login rate-limiting, and refresh-token revocation (would need a server-side token store). Both are reasonable next steps, deliberately deferred as lower-value-per-effort at this project's current scale — see the running "remaining tasks" discussion for the full list.

## Security notes before you deploy this anywhere real



- Change `SECRET_KEY` in `backend/.env.example` (copy it to `.env` and don't commit that).
- `snmp_community` and SSH credentials are stored as plain columns right now — encrypt
  them (e.g. with `cryptography`'s Fernet) before this touches production data.
- CORS is wide open (`allow_origins=["*"]`) for local dev — restrict it to your frontend's
  origin before deploying.
