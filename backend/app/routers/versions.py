from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import Version, ChangeRequest, Project, User
from app.schemas.schemas import VersionCreate, VersionUpdate, VersionRead, ReleaseReadinessResponse
from app.services.audit import log_action
from app.services.release_readiness import evaluate_release_readiness
from app.services.rbac import accessible_org_ids, require_org_access, require_role, version_org_id

router = APIRouter()


def _to_read(version: Version) -> VersionRead:
    data = VersionRead.model_validate(version)
    data.change_request_ids = [cr.id for cr in version.change_requests]
    return data


@router.get("", response_model=list[VersionRead])
def list_versions(project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Version)
    if project_id is not None:
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        require_org_access(db, user, project.organization_id)
        q = q.filter(Version.project_id == project_id)
    else:
        ids = accessible_org_ids(db, user)
        if ids is not None:
            if not ids:
                return []
            q = q.join(Project).filter(Project.organization_id.in_(ids))
    return [_to_read(v) for v in q.order_by(Version.created_at.desc()).all()]


@router.post("", response_model=VersionRead, status_code=201)
def create_version(payload: VersionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_role(db, user, project.organization_id, ["ADMIN", "MANAGER"])

    version = Version(project_id=payload.project_id, version_number=payload.version_number, description=payload.description)
    db.add(version)
    db.flush()

    if payload.change_request_ids:
        crs = db.query(ChangeRequest).filter(ChangeRequest.id.in_(payload.change_request_ids)).all()
        version.change_requests = crs

    db.commit()
    db.refresh(version)
    log_action(db, user, "CREATE", "Version", version.id, organization_id=project.organization_id, details=version.version_number)
    return _to_read(version)


@router.get("/{version_id}", response_model=VersionRead)
def get_version(version_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    version = db.get(Version, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    require_org_access(db, user, version_org_id(db, version_id))
    return _to_read(version)


@router.put("/{version_id}", response_model=VersionRead)
def update_version(version_id: int, payload: VersionUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    version = db.get(Version, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    org_id = version_org_id(db, version_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(version, field, value)
    db.commit()
    db.refresh(version)
    log_action(db, user, "UPDATE", "Version", version.id, organization_id=org_id)
    return _to_read(version)


@router.post("/{version_id}/change-requests/{cr_id}", response_model=VersionRead)
def attach_change_request(version_id: int, cr_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    version = db.get(Version, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    org_id = version_org_id(db, version_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    cr = db.get(ChangeRequest, cr_id)
    if not cr or cr.project_id != version.project_id:
        raise HTTPException(status_code=400, detail="Change request does not belong to this project")
    if cr not in version.change_requests:
        version.change_requests.append(cr)
        db.commit()
        db.refresh(version)
        log_action(db, user, "ATTACH_CR", "Version", version.id, organization_id=org_id, details=cr.code)
    return _to_read(version)


@router.delete("/{version_id}/change-requests/{cr_id}", response_model=VersionRead)
def detach_change_request(version_id: int, cr_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    version = db.get(Version, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    org_id = version_org_id(db, version_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    cr = db.get(ChangeRequest, cr_id)
    if cr and cr in version.change_requests:
        version.change_requests.remove(cr)
        db.commit()
        db.refresh(version)
        log_action(db, user, "DETACH_CR", "Version", version.id, organization_id=org_id, details=cr.code)
    return _to_read(version)


@router.delete("/{version_id}", status_code=204)
def delete_version(version_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    version = db.get(Version, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    org_id = version_org_id(db, version_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    db.delete(version)
    db.commit()
    log_action(db, user, "DELETE", "Version", version_id, organization_id=org_id)
    return None


@router.get("/{version_id}/release-readiness", response_model=ReleaseReadinessResponse)
def release_readiness(version_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    version = db.get(Version, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    require_org_access(db, user, version_org_id(db, version_id))
    result = evaluate_release_readiness(db, version)

    if result["ready"] and version.status != "RELEASED":
        version.status = "RELEASED"
        db.commit()

    return result
