from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import Deployment, Version, Project, User
from app.schemas.schemas import DeploymentCreate, DeploymentUpdate, DeploymentRead
from app.services.audit import log_action
from app.services.rbac import accessible_org_ids, require_org_access, require_role, version_org_id

router = APIRouter()


@router.get("", response_model=list[DeploymentRead])
def list_deployments(version_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Deployment)
    if version_id is not None:
        version = db.get(Version, version_id)
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        require_org_access(db, user, version_org_id(db, version_id))
        q = q.filter(Deployment.version_id == version_id)
    else:
        ids = accessible_org_ids(db, user)
        if ids is not None:
            if not ids:
                return []
            q = q.join(Version).join(Project).filter(Project.organization_id.in_(ids))
    return q.order_by(Deployment.created_at.desc()).all()


@router.post("", response_model=DeploymentRead, status_code=201)
def create_deployment(payload: DeploymentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    version = db.get(Version, payload.version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    org_id = version_org_id(db, payload.version_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])

    deployment = Deployment(
        version_id=payload.version_id,
        environment=payload.environment,
        status=payload.status,
        notes=payload.notes,
        deployed_at=datetime.now(timezone.utc) if payload.status == "COMPLETED" else None,
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    log_action(db, user, "CREATE", "Deployment", deployment.id, organization_id=org_id, details=f"{payload.environment} -> {payload.status}")
    return deployment


@router.put("/{deployment_id}", response_model=DeploymentRead)
def update_deployment(deployment_id: int, payload: DeploymentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    deployment = db.get(Deployment, deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    org_id = version_org_id(db, deployment.version_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(deployment, field, value)
    if payload.status == "COMPLETED" and not deployment.deployed_at:
        deployment.deployed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(deployment)
    log_action(db, user, "UPDATE", "Deployment", deployment.id, organization_id=org_id, details=deployment.status)
    return deployment


@router.delete("/{deployment_id}", status_code=204)
def delete_deployment(deployment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    deployment = db.get(Deployment, deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    org_id = version_org_id(db, deployment.version_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    db.delete(deployment)
    db.commit()
    log_action(db, user, "DELETE", "Deployment", deployment_id, organization_id=org_id)
    return None
