from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.models import Organization, OrganizationMembership, User, Project
from app.schemas.schemas import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationRead,
    MembershipCreate,
    MembershipUpdate,
    MembershipRead,
)
from app.services.audit import log_action
from app.services.rbac import accessible_org_ids, require_org_access

router = APIRouter()


def _to_read(db: Session, org: Organization) -> OrganizationRead:
    data = OrganizationRead.model_validate(org)
    data.project_count = db.query(Project).filter(Project.organization_id == org.id).count()
    data.member_count = (
        db.query(OrganizationMembership).filter(OrganizationMembership.organization_id == org.id).count()
    )
    return data


@router.get("", response_model=list[OrganizationRead])
def list_organizations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = accessible_org_ids(db, user)
    q = db.query(Organization)
    if ids is not None:
        if not ids:
            return []
        q = q.filter(Organization.id.in_(ids))
    orgs = q.order_by(Organization.name).all()
    return [_to_read(db, o) for o in orgs]


@router.post("", response_model=OrganizationRead, status_code=201)
def create_organization(payload: OrganizationCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    org = Organization(name=payload.name, description=payload.description)
    db.add(org)
    db.commit()
    db.refresh(org)
    log_action(db, user, "CREATE", "Organization", org.id, organization_id=org.id, details=org.name)
    return _to_read(db, org)


@router.get("/{org_id}", response_model=OrganizationRead)
def get_organization(org_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    require_org_access(db, user, org_id)
    return _to_read(db, org)


@router.put("/{org_id}", response_model=OrganizationRead)
def update_organization(org_id: int, payload: OrganizationUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    log_action(db, user, "UPDATE", "Organization", org.id, organization_id=org.id)
    return _to_read(db, org)


@router.post("/{org_id}/activate", response_model=OrganizationRead)
def activate_organization(org_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.status = "ACTIVE"
    db.commit()
    db.refresh(org)
    log_action(db, user, "ACTIVATE", "Organization", org.id, organization_id=org.id)
    return _to_read(db, org)


@router.post("/{org_id}/deactivate", response_model=OrganizationRead)
def deactivate_organization(org_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.status = "INACTIVE"
    db.commit()
    db.refresh(org)
    log_action(db, user, "DEACTIVATE", "Organization", org.id, organization_id=org.id)
    return _to_read(db, org)


@router.delete("/{org_id}", status_code=204)
def delete_organization(org_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    db.delete(org)
    db.commit()
    log_action(db, user, "DELETE", "Organization", org_id)
    return None


# ---------------- Members ----------------
def _membership_read(m: OrganizationMembership) -> MembershipRead:
    data = MembershipRead.model_validate(m)
    data.organization_name = m.organization.name if m.organization else None
    data.user_email = m.user.email if m.user else None
    data.user_name = m.user.full_name if m.user else None
    return data


@router.get("/{org_id}/members", response_model=list[MembershipRead])
def list_members(org_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_org_access(db, user, org_id)
    members = db.query(OrganizationMembership).filter(OrganizationMembership.organization_id == org_id).all()
    return [_membership_read(m) for m in members]


@router.post("/{org_id}/members", response_model=MembershipRead, status_code=201)
def add_member(org_id: int, payload: MembershipCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    target = db.query(User).filter(User.email == payload.email.lower()).first()
    if not target:
        raise HTTPException(status_code=404, detail="No user with that email exists")
    existing = (
        db.query(OrganizationMembership)
        .filter(OrganizationMembership.user_id == target.id, OrganizationMembership.organization_id == org_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this organization")

    membership = OrganizationMembership(user_id=target.id, organization_id=org_id, role=payload.role)
    db.add(membership)
    db.commit()
    db.refresh(membership)
    log_action(db, user, "ADD_MEMBER", "OrganizationMembership", membership.id, organization_id=org_id, details=f"{target.email} as {payload.role}")
    return _membership_read(membership)


@router.put("/{org_id}/members/{membership_id}", response_model=MembershipRead)
def update_member(org_id: int, membership_id: int, payload: MembershipUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    membership = db.get(OrganizationMembership, membership_id)
    if not membership or membership.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Membership not found")
    membership.role = payload.role
    db.commit()
    db.refresh(membership)
    log_action(db, user, "UPDATE_MEMBER_ROLE", "OrganizationMembership", membership.id, organization_id=org_id, details=payload.role)
    return _membership_read(membership)


@router.delete("/{org_id}/members/{membership_id}", status_code=204)
def remove_member(org_id: int, membership_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    membership = db.get(OrganizationMembership, membership_id)
    if not membership or membership.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Membership not found")
    db.delete(membership)
    db.commit()
    log_action(db, user, "REMOVE_MEMBER", "OrganizationMembership", membership_id, organization_id=org_id)
    return None
