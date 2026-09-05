from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import Baseline, BaselineItem, ConfigurationItem, Project, User
from app.schemas.schemas import BaselineCreate, BaselineUpdate, BaselineRead, BaselineItemRead
from app.services.audit import log_action
from app.services.rbac import accessible_org_ids, require_org_access, require_role, baseline_org_id

router = APIRouter()


def _to_read(baseline: Baseline) -> BaselineRead:
    data = BaselineRead.model_validate(baseline)
    items = []
    for item in baseline.items:
        ir = BaselineItemRead.model_validate(item)
        ir.ci_name = item.configuration_item.name if item.configuration_item else None
        items.append(ir)
    data.items = items
    return data


@router.get("", response_model=list[BaselineRead])
def list_baselines(project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Baseline)
    if project_id is not None:
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        require_org_access(db, user, project.organization_id)
        q = q.filter(Baseline.project_id == project_id)
    else:
        ids = accessible_org_ids(db, user)
        if ids is not None:
            if not ids:
                return []
            q = q.join(Project).filter(Project.organization_id.in_(ids))
    return [_to_read(b) for b in q.order_by(Baseline.created_at.desc()).all()]


@router.post("", response_model=BaselineRead, status_code=201)
def create_baseline(payload: BaselineCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_role(db, user, project.organization_id, ["ADMIN", "MANAGER"])

    baseline = Baseline(project_id=payload.project_id, name=payload.name, description=payload.description, status=payload.status)
    db.add(baseline)
    db.flush()

    for ci_id in payload.ci_ids:
        ci = db.get(ConfigurationItem, ci_id)
        if ci:
            db.add(BaselineItem(baseline_id=baseline.id, configuration_item_id=ci_id, version_snapshot=ci.version))

    db.commit()
    db.refresh(baseline)
    log_action(db, user, "CREATE", "Baseline", baseline.id, organization_id=project.organization_id, details=baseline.name)
    return _to_read(baseline)


@router.get("/{baseline_id}", response_model=BaselineRead)
def get_baseline(baseline_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    baseline = db.get(Baseline, baseline_id)
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")
    require_org_access(db, user, baseline_org_id(db, baseline_id))
    return _to_read(baseline)


@router.put("/{baseline_id}", response_model=BaselineRead)
def update_baseline(baseline_id: int, payload: BaselineUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    baseline = db.get(Baseline, baseline_id)
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")
    org_id = baseline_org_id(db, baseline_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(baseline, field, value)
    db.commit()
    db.refresh(baseline)
    log_action(db, user, "UPDATE", "Baseline", baseline.id, organization_id=org_id)
    return _to_read(baseline)


@router.delete("/{baseline_id}", status_code=204)
def delete_baseline(baseline_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    baseline = db.get(Baseline, baseline_id)
    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")
    org_id = baseline_org_id(db, baseline_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    db.delete(baseline)
    db.commit()
    log_action(db, user, "DELETE", "Baseline", baseline_id, organization_id=org_id)
    return None
