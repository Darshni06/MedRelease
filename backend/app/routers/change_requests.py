from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import ChangeRequest, Approval, ConfigurationItem, Project, User, CRStatus
from app.schemas.schemas import (
    ChangeRequestCreate,
    ChangeRequestUpdate,
    ChangeRequestRead,
    ApprovalCreate,
    ApprovalRead,
    ImpactAnalysisResponse,
)
from app.services.audit import log_action
from app.services.impact_analysis import analyze_impact
from app.services.rbac import accessible_org_ids, require_org_access, require_role, cr_org_id

router = APIRouter()


def _approval_read(a: Approval) -> ApprovalRead:
    data = ApprovalRead.model_validate(a)
    data.approver_name = a.approver.full_name if a.approver else None
    return data


def _to_read(cr: ChangeRequest) -> ChangeRequestRead:
    data = ChangeRequestRead.model_validate(cr)
    data.ci_name = cr.configuration_item.name if cr.configuration_item else None
    data.requested_by_name = cr.requested_by.full_name if cr.requested_by else None
    data.approvals = [_approval_read(a) for a in cr.approvals]
    return data


def _next_code(db: Session) -> str:
    count = db.query(ChangeRequest).count()
    return f"CR-{count + 1:03d}"


@router.get("", response_model=list[ChangeRequestRead])
def list_change_requests(project_id: int | None = None, status_filter: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(ChangeRequest)
    if project_id is not None:
        project = db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        require_org_access(db, user, project.organization_id)
        q = q.filter(ChangeRequest.project_id == project_id)
    else:
        ids = accessible_org_ids(db, user)
        if ids is not None:
            if not ids:
                return []
            q = q.join(Project).filter(Project.organization_id.in_(ids))
    if status_filter:
        q = q.filter(ChangeRequest.status == status_filter)
    crs = q.order_by(ChangeRequest.created_at.desc()).all()
    return [_to_read(c) for c in crs]


@router.post("", response_model=ChangeRequestRead, status_code=201)
def create_change_request(payload: ChangeRequestCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Developers, managers, and admins can all create change requests.
    require_role(db, user, project.organization_id, ["ADMIN", "MANAGER", "DEVELOPER"])

    ci = db.get(ConfigurationItem, payload.configuration_item_id)
    if not ci or ci.project_id != project.id:
        raise HTTPException(status_code=400, detail="Configuration item does not belong to this project")

    cr = ChangeRequest(
        code=_next_code(db),
        project_id=payload.project_id,
        configuration_item_id=payload.configuration_item_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        status=CRStatus.SUBMITTED.value,
        requested_by_id=user.id,
    )
    db.add(cr)
    db.commit()
    db.refresh(cr)
    log_action(db, user, "CREATE", "ChangeRequest", cr.id, organization_id=project.organization_id, details=f"{cr.code}: {cr.title}")
    return _to_read(cr)


@router.get("/{cr_id}", response_model=ChangeRequestRead)
def get_change_request(cr_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cr = db.get(ChangeRequest, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    require_org_access(db, user, cr_org_id(db, cr_id))
    return _to_read(cr)


@router.put("/{cr_id}", response_model=ChangeRequestRead)
def update_change_request(cr_id: int, payload: ChangeRequestUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cr = db.get(ChangeRequest, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    org_id = cr_org_id(db, cr_id)

    is_owner = cr.requested_by_id == user.id
    if not is_owner:
        require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    else:
        require_role(db, user, org_id, ["ADMIN", "MANAGER", "DEVELOPER"])

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cr, field, value)
    db.commit()
    db.refresh(cr)
    log_action(db, user, "UPDATE", "ChangeRequest", cr.id, organization_id=org_id, details=cr.code)
    return _to_read(cr)


@router.delete("/{cr_id}", status_code=204)
def delete_change_request(cr_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cr = db.get(ChangeRequest, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    org_id = cr_org_id(db, cr_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])
    db.delete(cr)
    db.commit()
    log_action(db, user, "DELETE", "ChangeRequest", cr_id, organization_id=org_id)
    return None


@router.get("/{cr_id}/impact-analysis", response_model=ImpactAnalysisResponse)
def cr_impact_analysis(cr_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cr = db.get(ChangeRequest, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    require_org_access(db, user, cr_org_id(db, cr_id))
    return analyze_impact(db, cr.configuration_item)


@router.post("/{cr_id}/approvals", response_model=ChangeRequestRead, status_code=201)
def approve_or_reject(cr_id: int, payload: ApprovalCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cr = db.get(ChangeRequest, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    org_id = cr_org_id(db, cr_id)
    require_role(db, user, org_id, ["ADMIN", "MANAGER"])

    decision = payload.decision.upper()
    if decision not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    approval = Approval(change_request_id=cr.id, approver_id=user.id, decision=decision, comments=payload.comments)
    db.add(approval)
    cr.status = CRStatus.APPROVED.value if decision == "APPROVED" else CRStatus.REJECTED.value
    db.commit()
    db.refresh(cr)
    log_action(db, user, "APPROVAL_" + decision, "ChangeRequest", cr.id, organization_id=org_id, details=payload.comments)
    return _to_read(cr)
