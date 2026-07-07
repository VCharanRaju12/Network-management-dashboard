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

## Security notes before you deploy this anywhere real

- Change `SECRET_KEY` in `backend/.env.example` (copy it to `.env` and don't commit that).
- `snmp_community` and SSH credentials are stored as plain columns right now — encrypt
  them (e.g. with `cryptography`'s Fernet) before this touches production data.
- CORS is wide open (`allow_origins=["*"]`) for local dev — restrict it to your frontend's
  origin before deploying.
