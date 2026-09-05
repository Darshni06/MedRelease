from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserRead"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


# ---------- Users / Memberships ----------
class MembershipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    organization_id: int
    user_id: int
    role: str
    organization_name: str | None = None
    user_email: str | None = None
    user_name: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    memberships: list[MembershipRead] = []


class MembershipCreate(BaseModel):
    email: EmailStr
    role: str


class MembershipUpdate(BaseModel):
    role: str


# ---------- Organizations ----------
class OrganizationCreate(BaseModel):
    name: str
    description: str = ""


class OrganizationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    status: str
    created_at: datetime
    project_count: int = 0
    member_count: int = 0


# ---------- Projects ----------
class ProjectCreate(BaseModel):
    organization_id: int
    name: str
    description: str = ""
    status: str = "ACTIVE"


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    organization_id: int
    name: str
    description: str
    status: str
    created_at: datetime
    ci_count: int = 0


# ---------- Configuration Items ----------
class ConfigurationItemCreate(BaseModel):
    project_id: int
    name: str
    description: str = ""
    status: str = "ACTIVE"
    version: str = "1.0"
    depends_on_ids: list[int] = []


class ConfigurationItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    version: str | None = None


class ConfigurationItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    name: str
    description: str
    status: str
    version: str
    created_at: datetime
    dependency_ids: list[int] = []
    dependent_ids: list[int] = []


class DependencyLinkRequest(BaseModel):
    depends_on_id: int


# ---------- Baselines ----------
class BaselineCreate(BaseModel):
    project_id: int
    name: str
    description: str = ""
    status: str = "DRAFT"
    ci_ids: list[int] = []


class BaselineUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None


class BaselineItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    configuration_item_id: int
    version_snapshot: str
    ci_name: str | None = None


class BaselineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    name: str
    description: str
    status: str
    created_at: datetime
    items: list[BaselineItemRead] = []


# ---------- Change Requests ----------
class ChangeRequestCreate(BaseModel):
    project_id: int
    configuration_item_id: int
    title: str
    description: str = ""
    priority: str = "MEDIUM"


class ChangeRequestUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    github_pr_number: int | None = None
    github_pr_url: str | None = None
    github_pr_state: str | None = None


class ApprovalCreate(BaseModel):
    decision: str  # APPROVED / REJECTED
    comments: str = ""


class ApprovalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    change_request_id: int
    approver_id: int
    approver_name: str | None = None
    decision: str
    comments: str
    created_at: datetime


class ChangeRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    project_id: int
    configuration_item_id: int
    ci_name: str | None = None
    title: str
    description: str
    priority: str
    status: str
    requested_by_id: int
    requested_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
    github_pr_number: int | None = None
    github_pr_url: str | None = None
    github_pr_state: str | None = None
    approvals: list[ApprovalRead] = []


class ImpactAnalysisResponse(BaseModel):
    configuration_item_id: int
    configuration_item_name: str
    direct_dependencies: list[dict]
    potentially_affected: list[dict]
    related_change_requests: list[dict]
    current_baseline: dict | None = None


# ---------- Versions ----------
class VersionCreate(BaseModel):
    project_id: int
    version_number: str
    description: str = ""
    change_request_ids: list[int] = []


class VersionUpdate(BaseModel):
    description: str | None = None
    status: str | None = None
    testing_completed: bool | None = None
    uat_completed: bool | None = None
    github_release_tag: str | None = None
    github_release_url: str | None = None
    github_release_name: str | None = None


class VersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    version_number: str
    description: str
    status: str
    testing_completed: bool
    uat_completed: bool
    created_at: datetime
    github_release_tag: str | None = None
    github_release_url: str | None = None
    github_release_name: str | None = None
    change_request_ids: list[int] = []


class ReadinessCheck(BaseModel):
    label: str
    passed: bool
    detail: str = ""


class ReleaseReadinessResponse(BaseModel):
    version_id: int
    version_number: str
    checks: list[ReadinessCheck]
    ready: bool
    blockers: list[str]


# ---------- Deployments ----------
class DeploymentCreate(BaseModel):
    version_id: int
    environment: str
    status: str = "PENDING"
    notes: str = ""


class DeploymentUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None


class DeploymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    version_id: int
    environment: str
    status: str
    notes: str
    deployed_at: datetime | None = None
    created_at: datetime


# ---------- GitHub ----------
class GitHubConnectionCreate(BaseModel):
    project_id: int
    repo_owner: str
    repo_name: str
    mode: str = "demo"
    token: str | None = None


class GitHubConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    repo_owner: str
    repo_name: str
    mode: str
    has_token: bool = False


# ---------- Audit Logs ----------
class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    organization_id: int | None
    user_id: int | None
    user_name: str | None = None
    action: str
    entity_type: str
    entity_id: int | None
    details: str
    created_at: datetime


# ---------- Dependency Graph ----------
class GraphNode(BaseModel):
    id: int
    label: str
    status: str


class GraphEdge(BaseModel):
    source: int
    target: int


class DependencyGraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
