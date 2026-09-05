import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Table,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.database import Base


def now_utc():
    return datetime.now(timezone.utc)


class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    DEVELOPER = "DEVELOPER"


class OrgStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class ProjectStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PLANNING = "PLANNING"
    COMPLETED = "COMPLETED"
    ON_HOLD = "ON_HOLD"


class CIStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PLANNING = "PLANNING"
    DEPRECATED = "DEPRECATED"


class BaselineStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"


class CRPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CRStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class VersionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    UAT = "UAT"
    RELEASED = "RELEASED"


class DeploymentEnvironment(str, enum.Enum):
    DEVELOPMENT = "DEVELOPMENT"
    TESTING = "TESTING"
    UAT = "UAT"
    PRODUCTION = "PRODUCTION"


class DeploymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# Self-referential many-to-many for CI dependencies:
# a row (ci_id, depends_on_id) means `ci_id` DEPENDS ON `depends_on_id`
ci_dependencies = Table(
    "ci_dependencies",
    Base.metadata,
    Column("ci_id", Integer, ForeignKey("configuration_items.id", ondelete="CASCADE"), primary_key=True),
    Column("depends_on_id", Integer, ForeignKey("configuration_items.id", ondelete="CASCADE"), primary_key=True),
)

# Which change requests are bundled into a version
version_change_requests = Table(
    "version_change_requests",
    Base.metadata,
    Column("version_id", Integer, ForeignKey("versions.id", ondelete="CASCADE"), primary_key=True),
    Column("change_request_id", Integer, ForeignKey("change_requests.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    memberships = relationship("OrganizationMembership", back_populates="user", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=OrgStatus.ACTIVE.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    memberships = relationship("OrganizationMembership", back_populates="organization", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (UniqueConstraint("user_id", "organization_id", name="uq_user_org"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20), default=RoleEnum.DEVELOPER.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user = relationship("User", back_populates="memberships")
    organization = relationship("Organization", back_populates="memberships")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=ProjectStatus.ACTIVE.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    organization = relationship("Organization", back_populates="projects")
    configuration_items = relationship("ConfigurationItem", back_populates="project", cascade="all, delete-orphan")
    baselines = relationship("Baseline", back_populates="project", cascade="all, delete-orphan")
    change_requests = relationship("ChangeRequest", back_populates="project", cascade="all, delete-orphan")
    versions = relationship("Version", back_populates="project", cascade="all, delete-orphan")
    github_connection = relationship("GitHubConnection", back_populates="project", uselist=False, cascade="all, delete-orphan")


class ConfigurationItem(Base):
    __tablename__ = "configuration_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=CIStatus.ACTIVE.value)
    version: Mapped[str] = mapped_column(String(50), default="1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    project = relationship("Project", back_populates="configuration_items")

    # CIs that THIS ci depends on
    dependencies = relationship(
        "ConfigurationItem",
        secondary=ci_dependencies,
        primaryjoin=id == ci_dependencies.c.ci_id,
        secondaryjoin=id == ci_dependencies.c.depends_on_id,
        backref="dependents",
    )
    change_requests = relationship("ChangeRequest", back_populates="configuration_item")


class Baseline(Base):
    __tablename__ = "baselines"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=BaselineStatus.DRAFT.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    project = relationship("Project", back_populates="baselines")
    items = relationship("BaselineItem", back_populates="baseline", cascade="all, delete-orphan")


class BaselineItem(Base):
    __tablename__ = "baseline_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    baseline_id: Mapped[int] = mapped_column(ForeignKey("baselines.id", ondelete="CASCADE"))
    configuration_item_id: Mapped[int] = mapped_column(ForeignKey("configuration_items.id", ondelete="CASCADE"))
    version_snapshot: Mapped[str] = mapped_column(String(50), default="1.0")

    baseline = relationship("Baseline", back_populates="items")
    configuration_item = relationship("ConfigurationItem")


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # e.g. CR-001
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    configuration_item_id: Mapped[int] = mapped_column(ForeignKey("configuration_items.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(20), default=CRPriority.MEDIUM.value)
    status: Mapped[str] = mapped_column(String(20), default=CRStatus.SUBMITTED.value)
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    github_pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    github_pr_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_pr_state: Mapped[str | None] = mapped_column(String(20), nullable=True)  # open/merged/closed

    project = relationship("Project", back_populates="change_requests")
    configuration_item = relationship("ConfigurationItem", back_populates="change_requests")
    requested_by = relationship("User")
    approvals = relationship("Approval", back_populates="change_request", cascade="all, delete-orphan")


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    change_request_id: Mapped[int] = mapped_column(ForeignKey("change_requests.id", ondelete="CASCADE"))
    approver_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String(20))  # APPROVED / REJECTED
    comments: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    change_request = relationship("ChangeRequest", back_populates="approvals")
    approver = relationship("User")


class Version(Base):
    __tablename__ = "versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    version_number: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=VersionStatus.DRAFT.value)
    testing_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    uat_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    github_release_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    github_release_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_release_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    project = relationship("Project", back_populates="versions")
    change_requests = relationship("ChangeRequest", secondary=version_change_requests)
    deployments = relationship("Deployment", back_populates="version", cascade="all, delete-orphan")


class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("versions.id", ondelete="CASCADE"))
    environment: Mapped[str] = mapped_column(String(20), default=DeploymentEnvironment.DEVELOPMENT.value)
    status: Mapped[str] = mapped_column(String(20), default=DeploymentStatus.PENDING.value)
    notes: Mapped[str] = mapped_column(Text, default="")
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    version = relationship("Version", back_populates="deployments")


class GitHubConnection(Base):
    __tablename__ = "github_connections"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    repo_owner: Mapped[str] = mapped_column(String(255), default="")
    repo_name: Mapped[str] = mapped_column(String(255), default="")
    mode: Mapped[str] = mapped_column(String(10), default="demo")  # demo / real
    token: Mapped[str | None] = mapped_column(String(500), nullable=True)  # optional override of env token
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    project = relationship("Project", back_populates="github_connection")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    organization = relationship("Organization", back_populates="audit_logs")
    user = relationship("User")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user = relationship("User", back_populates="reset_tokens")
