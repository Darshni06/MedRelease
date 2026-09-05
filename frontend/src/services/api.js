const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("medrelease_token");
}

async function request(path, { method = "GET", body, auth = true, params } = {}) {
  let url = `${API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = data?.detail || res.statusText || "Request failed";
    const error = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // auth
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload, auth: false }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  forgotPassword: (payload) => request("/api/auth/forgot-password", { method: "POST", body: payload, auth: false }),
  resetPassword: (payload) => request("/api/auth/reset-password", { method: "POST", body: payload, auth: false }),

  // users
  listUsers: () => request("/api/users"),

  // organizations
  listOrganizations: () => request("/api/organizations"),
  getOrganization: (id) => request(`/api/organizations/${id}`),
  createOrganization: (payload) => request("/api/organizations", { method: "POST", body: payload }),
  updateOrganization: (id, payload) => request(`/api/organizations/${id}`, { method: "PUT", body: payload }),
  activateOrganization: (id) => request(`/api/organizations/${id}/activate`, { method: "POST" }),
  deactivateOrganization: (id) => request(`/api/organizations/${id}/deactivate`, { method: "POST" }),
  deleteOrganization: (id) => request(`/api/organizations/${id}`, { method: "DELETE" }),
  listMembers: (orgId) => request(`/api/organizations/${orgId}/members`),
  addMember: (orgId, payload) => request(`/api/organizations/${orgId}/members`, { method: "POST", body: payload }),
  updateMember: (orgId, membershipId, payload) =>
    request(`/api/organizations/${orgId}/members/${membershipId}`, { method: "PUT", body: payload }),
  removeMember: (orgId, membershipId) =>
    request(`/api/organizations/${orgId}/members/${membershipId}`, { method: "DELETE" }),

  // projects
  listProjects: (organizationId) => request("/api/projects", { params: { organization_id: organizationId } }),
  getProject: (id) => request(`/api/projects/${id}`),
  createProject: (payload) => request("/api/projects", { method: "POST", body: payload }),
  updateProject: (id, payload) => request(`/api/projects/${id}`, { method: "PUT", body: payload }),
  deleteProject: (id) => request(`/api/projects/${id}`, { method: "DELETE" }),

  // configuration items
  listConfigurationItems: (projectId) => request("/api/configuration-items", { params: { project_id: projectId } }),
  getConfigurationItem: (id) => request(`/api/configuration-items/${id}`),
  createConfigurationItem: (payload) => request("/api/configuration-items", { method: "POST", body: payload }),
  updateConfigurationItem: (id, payload) => request(`/api/configuration-items/${id}`, { method: "PUT", body: payload }),
  deleteConfigurationItem: (id) => request(`/api/configuration-items/${id}`, { method: "DELETE" }),
  addDependency: (ciId, dependsOnId) =>
    request(`/api/configuration-items/${ciId}/dependencies`, { method: "POST", body: { depends_on_id: dependsOnId } }),
  removeDependency: (ciId, dependsOnId) =>
    request(`/api/configuration-items/${ciId}/dependencies/${dependsOnId}`, { method: "DELETE" }),
  ciImpactAnalysis: (ciId) => request(`/api/configuration-items/${ciId}/impact-analysis`),

  // baselines
  listBaselines: (projectId) => request("/api/baselines", { params: { project_id: projectId } }),
  getBaseline: (id) => request(`/api/baselines/${id}`),
  createBaseline: (payload) => request("/api/baselines", { method: "POST", body: payload }),
  updateBaseline: (id, payload) => request(`/api/baselines/${id}`, { method: "PUT", body: payload }),
  deleteBaseline: (id) => request(`/api/baselines/${id}`, { method: "DELETE" }),

  // change requests
  listChangeRequests: (projectId, statusFilter) =>
    request("/api/change-requests", { params: { project_id: projectId, status_filter: statusFilter } }),
  getChangeRequest: (id) => request(`/api/change-requests/${id}`),
  createChangeRequest: (payload) => request("/api/change-requests", { method: "POST", body: payload }),
  updateChangeRequest: (id, payload) => request(`/api/change-requests/${id}`, { method: "PUT", body: payload }),
  deleteChangeRequest: (id) => request(`/api/change-requests/${id}`, { method: "DELETE" }),
  crImpactAnalysis: (id) => request(`/api/change-requests/${id}/impact-analysis`),
  approveChangeRequest: (id, payload) => request(`/api/change-requests/${id}/approvals`, { method: "POST", body: payload }),

  // versions
  listVersions: (projectId) => request("/api/versions", { params: { project_id: projectId } }),
  getVersion: (id) => request(`/api/versions/${id}`),
  createVersion: (payload) => request("/api/versions", { method: "POST", body: payload }),
  updateVersion: (id, payload) => request(`/api/versions/${id}`, { method: "PUT", body: payload }),
  deleteVersion: (id) => request(`/api/versions/${id}`, { method: "DELETE" }),
  attachChangeRequest: (versionId, crId) =>
    request(`/api/versions/${versionId}/change-requests/${crId}`, { method: "POST" }),
  detachChangeRequest: (versionId, crId) =>
    request(`/api/versions/${versionId}/change-requests/${crId}`, { method: "DELETE" }),
  releaseReadiness: (versionId) => request(`/api/versions/${versionId}/release-readiness`),

  // deployments
  listDeployments: (versionId) => request("/api/deployments", { params: { version_id: versionId } }),
  createDeployment: (payload) => request("/api/deployments", { method: "POST", body: payload }),
  updateDeployment: (id, payload) => request(`/api/deployments/${id}`, { method: "PUT", body: payload }),
  deleteDeployment: (id) => request(`/api/deployments/${id}`, { method: "DELETE" }),

  // github
  getGithubConnection: (projectId) => request(`/api/github/${projectId}/connection`),
  upsertGithubConnection: (projectId, payload) =>
    request(`/api/github/${projectId}/connection`, { method: "PUT", body: payload }),
  githubRepository: (projectId) => request(`/api/github/${projectId}/repository`),
  githubBranches: (projectId) => request(`/api/github/${projectId}/branches`),
  githubCommits: (projectId, branch) => request(`/api/github/${projectId}/commits`, { params: { branch } }),
  githubPulls: (projectId, state) => request(`/api/github/${projectId}/pulls`, { params: { state } }),
  githubIssues: (projectId) => request(`/api/github/${projectId}/issues`),
  githubReleases: (projectId) => request(`/api/github/${projectId}/releases`),

  // audit logs
  listAuditLogs: (params) => request("/api/audit-logs", { params }),

  // dependency graph
  dependencyGraph: (projectId) => request(`/api/dependency-graph/${projectId}`),
};

export { getToken };
