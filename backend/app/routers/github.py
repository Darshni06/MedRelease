from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import GitHubConnection, Project, User
from app.schemas.schemas import GitHubConnectionCreate, GitHubConnectionRead
from app.services.audit import log_action
from app.services.github_service import GitHubService
from app.services.rbac import require_org_access, require_role, project_org_id

router = APIRouter()


def _service_for_project(db: Session, project_id: int) -> GitHubService:
    conn = db.query(GitHubConnection).filter(GitHubConnection.project_id == project_id).first()
    if conn:
        return GitHubService(token=conn.token, repo_owner=conn.repo_owner, repo_name=conn.repo_name, mode=conn.mode)
    return GitHubService()


@router.get("/{project_id}/connection", response_model=GitHubConnectionRead | None)
def get_connection(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    conn = db.query(GitHubConnection).filter(GitHubConnection.project_id == project_id).first()
    if not conn:
        return None
    data = GitHubConnectionRead.model_validate(conn)
    data.has_token = bool(conn.token)
    return data


@router.put("/{project_id}/connection", response_model=GitHubConnectionRead)
def upsert_connection(project_id: int, payload: GitHubConnectionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_role(db, user, project.organization_id, ["ADMIN", "MANAGER"])

    conn = db.query(GitHubConnection).filter(GitHubConnection.project_id == project_id).first()
    if not conn:
        conn = GitHubConnection(project_id=project_id)
        db.add(conn)
    conn.repo_owner = payload.repo_owner
    conn.repo_name = payload.repo_name
    conn.mode = payload.mode
    if payload.token is not None:
        conn.token = payload.token
    db.commit()
    db.refresh(conn)
    log_action(db, user, "UPDATE_GITHUB_CONNECTION", "Project", project_id, organization_id=project.organization_id, details=f"{conn.repo_owner}/{conn.repo_name} ({conn.mode})")

    data = GitHubConnectionRead.model_validate(conn)
    data.has_token = bool(conn.token)
    return data


@router.get("/{project_id}/repository")
def repository(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    return _service_for_project(db, project_id).get_repository()


@router.get("/{project_id}/branches")
def branches(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    return _service_for_project(db, project_id).get_branches()


@router.get("/{project_id}/commits")
def commits(project_id: int, branch: str = "main", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    return _service_for_project(db, project_id).get_commits(branch=branch)


@router.get("/{project_id}/pulls")
def pulls(project_id: int, state: str = "open", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    return _service_for_project(db, project_id).get_pull_requests(state=state)


@router.get("/{project_id}/issues")
def issues(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    return _service_for_project(db, project_id).get_issues()


@router.get("/{project_id}/releases")
def releases(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    return _service_for_project(db, project_id).get_releases()


@router.get("/{project_id}/pulls/{pr_number}/validate")
def validate_pr(project_id: int, pr_number: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    exists = _service_for_project(db, project_id).validate_pr_exists(pr_number)
    return {"exists": exists}


@router.get("/{project_id}/releases/{tag}/validate")
def validate_release(project_id: int, tag: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, project_org_id(db, project_id))
    exists = _service_for_project(db, project_id).validate_release_exists(tag)
    return {"exists": exists}
