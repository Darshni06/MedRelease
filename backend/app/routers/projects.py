from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import Project, ConfigurationItem, Organization, User
from app.schemas.schemas import ProjectCreate, ProjectUpdate, ProjectRead
from app.services.audit import log_action
from app.services.rbac import accessible_org_ids, require_org_access, require_role

router = APIRouter()


def _to_read(db: Session, project: Project) -> ProjectRead:
    data = ProjectRead.model_validate(project)
    data.ci_count = db.query(ConfigurationItem).filter(ConfigurationItem.project_id == project.id).count()
    return data


@router.get("", response_model=list[ProjectRead])
def list_projects(organization_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = accessible_org_ids(db, user)
    q = db.query(Project)
    if organization_id is not None:
        require_org_access(db, user, organization_id)
        q = q.filter(Project.organization_id == organization_id)
    elif ids is not None:
        if not ids:
            return []
        q = q.filter(Project.organization_id.in_(ids))
    projects = q.order_by(Project.name).all()
    return [_to_read(db, p) for p in projects]


@router.post("", response_model=ProjectRead, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org = db.get(Organization, payload.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    require_role(db, user, payload.organization_id, ["ADMIN", "MANAGER"])

    project = Project(
        organization_id=payload.organization_id,
        name=payload.name,
        description=payload.description,
        status=payload.status,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    log_action(db, user, "CREATE", "Project", project.id, organization_id=org.id, details=project.name)
    return _to_read(db, project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_org_access(db, user, project.organization_id)
    return _to_read(db, project)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_role(db, user, project.organization_id, ["ADMIN", "MANAGER"])
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    log_action(db, user, "UPDATE", "Project", project.id, organization_id=project.organization_id)
    return _to_read(db, project)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_role(db, user, project.organization_id, ["ADMIN", "MANAGER"])
    org_id = project.organization_id
    db.delete(project)
    db.commit()
    log_action(db, user, "DELETE", "Project", project_id, organization_id=org_id)
    return None
