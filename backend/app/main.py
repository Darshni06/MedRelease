from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database import Base, engine

from app.routers.auth import router as auth_router
from app.routers.organizations import router as organizations_router
from app.routers.projects import router as projects_router
from app.routers.configuration_items import router as configuration_items_router
from app.routers.baselines import router as baselines_router
from app.routers.change_requests import router as change_requests_router
from app.routers.versions import router as versions_router
from app.routers.deployments import router as deployments_router
from app.routers.github import router as github_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.dependency_graph import router as dependency_graph_router
from app.routers.users import router as users_router

Base.metadata.create_all(bind=engine)

if settings.auto_seed:
    try:
        from app.seed import seed
        seed()
    except Exception as exc:  # pragma: no cover - never block startup on seed issues
        print(f"[startup] Seeding skipped due to error: {exc}")

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Multi-organization Software Configuration & Release Management platform for healthcare software teams.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(organizations_router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(projects_router, prefix="/api/projects", tags=["Projects"])
app.include_router(configuration_items_router, prefix="/api/configuration-items", tags=["Configuration Items"])
app.include_router(baselines_router, prefix="/api/baselines", tags=["Baselines"])
app.include_router(change_requests_router, prefix="/api/change-requests", tags=["Change Requests"])
app.include_router(versions_router, prefix="/api/versions", tags=["Versions"])
app.include_router(deployments_router, prefix="/api/deployments", tags=["Deployments"])
app.include_router(github_router, prefix="/api/github", tags=["GitHub Integration"])
app.include_router(audit_logs_router, prefix="/api/audit-logs", tags=["Audit Logs"])
app.include_router(dependency_graph_router, prefix="/api/dependency-graph", tags=["Dependency Graph"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "medrelease-api"}


@app.get("/")
def root():
    return {"service": "MedRelease API", "docs": "/docs", "health": "/health"}
