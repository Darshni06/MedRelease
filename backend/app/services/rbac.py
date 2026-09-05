"""Role-based access control & organization data-isolation helpers.

All isolation is enforced here, on the backend, never trusting the frontend.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.models import (
    User,
    OrganizationMembership,
    Project,
    ConfigurationItem,
    ChangeRequest,
    Version,
    Baseline,
)


def get_membership(db: Session, user: User, organization_id: int) -> OrganizationMembership | None:
    return (
        db.query(OrganizationMembership)
        .filter(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.organization_id == organization_id,
        )
        .first()
    )


def accessible_org_ids(db: Session, user: User) -> list[int] | None:
    """Returns None if user is a global admin (meaning: unrestricted / all orgs)."""
    if user.is_admin:
        return None
    return [m.organization_id for m in user.memberships]


def require_org_access(db: Session, user: User, organization_id: int) -> OrganizationMembership | None:
    if user.is_admin:
        return None
    membership = get_membership(db, user, organization_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this organization's data",
        )
    return membership


def require_role(db: Session, user: User, organization_id: int, allowed_roles: list[str]):
    if user.is_admin:
        return
    membership = require_org_access(db, user, organization_id)
    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires one of roles {allowed_roles}, you have {membership.role}",
        )


def project_org_id(db: Session, project_id: int) -> int:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.organization_id


def ci_org_id(db: Session, ci_id: int) -> int:
    ci = db.get(ConfigurationItem, ci_id)
    if not ci:
        raise HTTPException(status_code=404, detail="Configuration item not found")
    return project_org_id(db, ci.project_id)


def cr_org_id(db: Session, cr_id: int) -> int:
    cr = db.get(ChangeRequest, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    return project_org_id(db, cr.project_id)


def version_org_id(db: Session, version_id: int) -> int:
    version = db.get(Version, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return project_org_id(db, version.project_id)


def baseline_org_id(db: Session, baseline_id: int) -> int:
    bl = db.get(Baseline, baseline_id)
    if not bl:
        raise HTTPException(status_code=404, detail="Baseline not found")
    return project_org_id(db, bl.project_id)
