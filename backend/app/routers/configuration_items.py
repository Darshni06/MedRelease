from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import ConfigurationItem, Project, User
from app.schemas.schemas import (
    ConfigurationItemCreate,
    ConfigurationItemUpdate,
    ConfigurationItemRead,
    DependencyLinkRequest,
    ImpactAnalysisResponse,
)
from app.services.audit import log_action
from app.services.impact_analysis import analyze_impact
from app.services.rbac import accessible_org_ids, require_org_access, require_role, ci_org_id

router = APIRouter()


def _to_read(ci: ConfigurationItem) -> ConfigurationItemRead:
    data = ConfigurationItemRead.model_validate(ci)
    data.dependency_ids = [d.id for d in ci.dependencies]
    data.dependent_ids = [d.id for d in ci.dependents]
    return data


@router.get("", response_model=list[ConfigurationItemRead])
def list_cis(project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(ConfigurationItem)
    if project_id is not None:
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        require_org_access(db, user, project.organization_id)
        q = q.filter(ConfigurationItem.project_id == project_id)
    else:
        ids = accessible_org_ids(db, user)
        if ids is not None:
            if not ids:
                return []
            q = q.join(Project).filter(Project.organization_id.in_(ids))
    cis = q.order_by(ConfigurationItem.name).all()
    return [_to_read(c) for c in cis]


@router.post("", response_model=ConfigurationItemRead, status_code=201)
def create_ci(payload: ConfigurationItemCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_role(db, user, project.organization_id, ["ADMIN", "MANAGER"])

    ci = ConfigurationItem(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        status=payload.status,
        version=payload.version,
    )
    db.add(ci)
    db.flush()

    if payload.depends_on_ids:
        deps = db.query(ConfigurationItem).filter(ConfigurationItem.id.in_(payload.depends_on_ids)).all()
        ci.dependencies = deps

    db.commit()
    db.refresh(ci)
    log_action(db, user, "CREATE", "ConfigurationItem", ci.id, organization_id=project.organization_id, details=ci.name)
    return _to_read(ci)


@router.get("/{ci_id}", response_model=ConfigurationItemRead)
def get_ci(ci_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ci = db.get(ConfigurationItem, ci_id)
    if not ci:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    require_org_access(db, user, ci_org_id(db, ci_id))
    return _to_read(ci)


@router.put("/{ci_id}", response_model=ConfigurationItemRead)
def update_ci(ci_id: int, payload: ConfigurationItemUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ci = db.get(ConfigurationItem, ci_id)
    if not ci:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    org_id = ci_org_id(db, ci_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ci, field, value)
    db.commit()
    db.refresh(ci)
    log_action(db, user, "UPDATE", "ConfigurationItem", ci.id, organization_id=org_id)
    return _to_read(ci)


@router.delete("/{ci_id}", status_code=204)
def delete_ci(ci_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ci = db.get(ConfigurationItem, ci_id)
    if not ci:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    org_id = ci_org_id(db, ci_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    db.delete(ci)
    db.commit()
    log_action(db, user, "DELETE", "ConfigurationItem", ci_id, organization_id=org_id)
    return None


@router.post("/{ci_id}/dependencies", response_model=ConfigurationItemRead, status_code=201)
def add_dependency(ci_id: int, payload: DependencyLinkRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ci = db.get(ConfigurationItem, ci_id)
    if not ci:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    org_id = ci_org_id(db, ci_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])

    dep = db.get(ConfigurationItem, payload.depends_on_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Dependency target configuration item not found")
    if dep.id == ci.id:
        raise HTTPException(status_code=400, detail="A configuration item cannot depend on itself")
    if dep not in ci.dependencies:
        ci.dependencies.append(dep)
        db.commit()
        db.refresh(ci)
        log_action(db, user, "ADD_DEPENDENCY", "ConfigurationItem", ci.id, organization_id=org_id, details=f"depends on {dep.name}")
    return _to_read(ci)


@router.delete("/{ci_id}/dependencies/{depends_on_id}", response_model=ConfigurationItemRead)
def remove_dependency(ci_id: int, depends_on_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ci = db.get(ConfigurationItem, ci_id)
    if not ci:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    org_id = ci_org_id(db, ci_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])

    dep = db.get(ConfigurationItem, depends_on_id)
    if dep and dep in ci.dependencies:
        ci.dependencies.remove(dep)
        db.commit()
        db.refresh(ci)
        log_action(db, user, "REMOVE_DEPENDENCY", "ConfigurationItem", ci.id, organization_id=org_id, details=f"no longer depends on {dep.name}")
    return _to_read(ci)


@router.get("/{ci_id}/impact-analysis", response_model=ImpactAnalysisResponse)
def impact_analysis(ci_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ci = db.get(ConfigurationItem, ci_id)
    if not ci:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    require_org_access(db, user, ci_org_id(db, ci_id))
    return analyze_impact(db, ci)
