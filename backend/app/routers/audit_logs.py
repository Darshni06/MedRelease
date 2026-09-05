from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import AuditLog, User
from app.schemas.schemas import AuditLogRead
from app.services.rbac import accessible_org_ids, require_org_access

router = APIRouter()


def _to_read(entry: AuditLog) -> AuditLogRead:
    data = AuditLogRead.model_validate(entry)
    data.user_name = entry.user.full_name if entry.user else "System"
    return data


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    organization_id: int | None = None,
    entity_type: str | None = None,
    action: str | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(AuditLog)
    if organization_id is not None:
        require_org_access(db, user, organization_id)
        q = q.filter(AuditLog.organization_id == organization_id)
    else:
        ids = accessible_org_ids(db, user)
        if ids is not None:
            if not ids:
                return []
            q = q.filter(AuditLog.organization_id.in_(ids))
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(AuditLog.action == action)
    entries = q.order_by(AuditLog.created_at.desc()).limit(min(limit, 1000)).all()
    return [_to_read(e) for e in entries]
