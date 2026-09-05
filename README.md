# MedRelease

A multi-organization **Software Configuration Management (SCM) and Release
Management** platform for healthcare software teams.

MedRelease does **not** manage hospitals, patients, or appointments. It
manages the *software lifecycle* of the systems that hospitals use: change
requests, dependency mapping, release readiness, GitHub integration,
deployments, and audit history — across multiple organizations, each with
proper data isolation.

```
Organizations → Projects → Configuration Items
        ↓
Change Requests → Approval → GitHub → Version
        ↓
Release Readiness → Deployment → Audit Log
```

## Stack

- **Backend:** FastAPI + SQLAlchemy + Alembic + JWT auth (Python 3.12)
- **Frontend:** React 19 + Vite + React Router 7 + Tailwind CSS v4
- **Database:** SQLite for local dev, PostgreSQL for production (Render)

## Project layout

```
MedRelease/
├── backend/
│   ├── app/
│   │   ├── core/            # settings, security (JWT, password hashing)
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── routers/         # one router per resource
│   │   ├── services/        # RBAC, audit log, GitHub client, impact
│   │   │                      analysis, release readiness
│   │   ├── database.py
│   │   ├── dependencies.py  # auth dependencies
│   │   ├── seed.py          # sample data seed script
│   │   └── main.py
│   ├── alembic/              # database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # shared UI (table, modal, badges, layout...)
│   │   ├── pages/            # one file per screen
│   │   ├── context/          # auth + toast context
│   │   └── services/api.js   # typed fetch wrapper around the backend
│   └── .env.example
└── render.yaml               # one-click Render Blueprint (backend + frontend + DB)
```

## Quick start (local development)

**Backend** (from `backend/`):

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

The API starts at `http://localhost:8000`, auto-creates the SQLite database,
and seeds sample data on first boot (see accounts below). API docs are at
`http://localhost:8000/docs`.

**Frontend** (from `frontend/`, in a second terminal):

```bash
npm install
cp .env.example .env
npm run dev
```

The app starts at `http://localhost:5173` and talks to the backend via
`VITE_API_URL` (defaults to `http://localhost:8000`).

That's 3 commands per side, and you have a working app.

### Sample accounts

All seeded accounts use the password `Password123!`.

| Email | Role | Organization |
|---|---|---|
| admin@medrelease.com | ADMIN | All organizations |
| manager@medicare.com | MANAGER | MediCare Hospital |
| developer@medicare.com | DEVELOPER | MediCare Hospital |
| manager@citycare.com | MANAGER | CityCare Hospital |
| developer@citycare.com | DEVELOPER | CityCare Hospital |

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLite locally, PostgreSQL in production | `sqlite:///./medrelease.db` |
| `JWT_SECRET_KEY` | Signs auth tokens — set a real secret in production | dev placeholder |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session length | `1440` (24h) |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | localhost |
| `GITHUB_MODE` | `demo` or `real` | `demo` |
| `GITHUB_TOKEN` | GitHub Personal Access Token, backend-only, only used in `real` mode | empty |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` | Default repo for demo/real mode | seeded values |
| `AUTO_SEED` | Seed sample data on boot if the DB is empty | `true` |

### Frontend (`frontend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Base URL of the backend API | `http://localhost:8000` |

## Authentication & roles

- JWT bearer tokens, bcrypt-hashed passwords.
- Forgot/reset password flow: in development, the reset token is logged to
  the server console and also returned in the API response so you can test
  the flow without an email provider. **Remove the token from the response
  before using this in a real production deployment with real users.**
- Three roles, scoped per organization membership: **ADMIN**, **MANAGER**,
  **DEVELOPER**. A user can belong to multiple organizations with different
  roles in each. A separate `is_admin` flag marks system-wide administrators
  who can see and manage every organization.
- **All data isolation is enforced on the backend** (see
  `app/services/rbac.py`), never trusted to the frontend. Every list/detail
  endpoint filters by the caller's organization memberships unless they are
  a system admin.

## Key features

- **Change Impact & Dependency Mapping** — configuration items have
  self-referential dependencies; the dependency graph page renders them
  visually (click a node to jump to its impact analysis), and both
  configuration items and change requests expose a `/impact-analysis`
  endpoint showing direct dependencies, potentially-affected items,
  related change requests, and the current approved baseline.
- **Release Readiness Check** — `GET /api/versions/{id}/release-readiness`
  evaluates six conditions (approvals, completion, baseline, GitHub PR
  merge state, testing, UAT) and reports a clear blocker list; a version is
  automatically marked `RELEASED` once every check passes.
- **GitHub integration** — `app/services/github_service.py` supports a
  `demo` mode (clearly-labeled seeded data, no network calls) and a `real`
  mode (live GitHub REST API calls using a server-side token). The token
  never reaches the frontend; the browser only ever calls MedRelease's own
  `/api/github/*` endpoints.
- **Audit logging** — every create/update/delete/approval/login action is
  recorded with actor, organization, entity, and details, queryable and
  filterable at `/api/audit-logs`.

## Deploying to Render

The included `render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec)
that provisions all three pieces in one step:

1. Push this repository to GitHub.
2. In the Render dashboard, choose **New +** → **Blueprint**, and point it at
   your repository.
3. Render will create:
   - `medrelease-db` — a free PostgreSQL database
   - `medrelease-backend` — a Python web service that runs
     `alembic upgrade head` then starts `uvicorn`, wired to the database
     automatically via `DATABASE_URL`
   - `medrelease-frontend` — a static site built with `npm run build`,
     served with SPA rewrites so client-side routing works
4. After the first deploy, set `GITHUB_TOKEN` on the backend service if you
   want to use `real` GitHub mode (optional — `demo` mode works out of the
   box).
5. Once the backend's public URL is known, double-check `CORS_ORIGINS` on
   the backend and `VITE_API_URL` on the frontend point at each other
   (the blueprint pre-fills the default `*.onrender.com` names — update them
   if you rename the services).

### Deploying manually (without the Blueprint)

**Backend — Web Service**
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment variables: see table above (`DATABASE_URL` should point at a
  managed PostgreSQL instance)

**Frontend — Static Site**
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_URL` = your backend's public URL
- Add a rewrite rule `/* → /index.html` so client-side routes work on refresh

A `Dockerfile` is also included in `backend/` if you'd rather deploy the API
as a container on Render or elsewhere.

## API documentation

Interactive OpenAPI docs are served by the backend itself at `/docs`
(Swagger UI) and `/redoc` once it's running — that's the canonical reference
for every endpoint, request/response shape, and status code.

## What's intentionally out of scope

Per the project brief, MedRelease manages the *software lifecycle*, not the
hospitals themselves. The MediCare Hospital and CityCare Hospital websites
referenced in the seed data are separate, future projects (static marketing
sites with no backend) that will eventually be tracked *as projects inside*
MedRelease — they are not part of this codebase.
