from sqlalchemy.orm import Session

from app.models.models import AuditLog, User


def log_action(
    db: Session,
    user: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    organization_id: int | None = None,
    details: str = "",
):
    entry = AuditLog(
        organization_id=organization_id,
        user_id=user.id if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(entry)
    db.commit()
    return entry
