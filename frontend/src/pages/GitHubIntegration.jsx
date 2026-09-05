import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GitCommit, GitPullRequest, Tag, GitFork, Settings } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { TextField, SelectField } from "../components/FormField";

export default function GitHubIntegration() {
  const { user, currentOrgId } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";

  const [projects, setProjects] = useState([]);
  const [repo, setRepo] = useState(null);
  const [commits, setCommits] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [releases, setReleases] = useState([]);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form, setForm] = useState({ repo_owner: "", repo_name: "", mode: "demo", token: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const orgId = user?.is_admin ? undefined : currentOrgId ?? undefined;
      const projectList = await api.listProjects(orgId);
      setProjects(projectList);
      const activeProject = projectId || projectList[0]?.id;
      if (activeProject) {
        const [r, c, p, rel, conn] = await Promise.all([
          api.githubRepository(activeProject),
          api.githubCommits(activeProject),
          api.githubPulls(activeProject, "all"),
          api.githubReleases(activeProject),
          api.getGithubConnection(activeProject),
        ]);
        setRepo(r);
        setCommits(c);
        setPulls(p);
        setReleases(rel);
        setConnection(conn);
        setForm({
          repo_owner: conn?.repo_owner || "",
          repo_name: conn?.repo_name || "",
          mode: conn?.mode || "demo",
          token: "",
        });
        if (!projectId) setParams({ project: String(activeProject) });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentOrgId]);

  const saveConnection = async (e) => {
    e.preventDefault();
    try {
      await api.upsertGithubConnection(projectId || projects[0]?.id, {
        project_id: Number(projectId || projects[0]?.id),
        repo_owner: form.repo_owner,
        repo_name: form.repo_name,
        mode: form.mode,
        token: form.token || null,
      });
      toast.success("GitHub connection updated");
      setSettingsOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="GitHub Integration"
        subtitle="Repository activity for the selected project. Backend-only token access — never exposed to the browser."
        actions={
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} /> Connection settings
          </Button>
        }
      />

      {projects.length > 0 && (
        <div className="mb-4">
          <select
            value={projectId}
            onChange={(e) => setParams({ project: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {repo && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-1 flex items-center gap-2">
            <GitFork size={18} className="text-slate-700" />
            <a href={repo.html_url} target="_blank" rel="noreferrer" className="font-semibold text-slate-800 hover:underline">
              {repo.full_name}
            </a>
            {repo.mode === "demo" && <Badge value="DEMO" className="bg-amber-100 text-amber-700" />}
          </div>
          <p className="text-sm text-slate-500">{repo.description}</p>
          <div className="mt-2 flex gap-4 text-xs text-slate-400">
            <span>Default branch: {repo.default_branch}</span>
            <span>★ {repo.stargazers_count}</span>
            <span>{repo.open_issues_count} open issues</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <GitCommit size={15} /> Recent commits
          </h2>
          <div className="space-y-3">
            {commits.map((c) => (
              <div key={c.sha} className="text-sm">
                <p className="font-medium text-slate-700">{c.message}</p>
                <p className="text-xs text-slate-400">
                  {c.sha} · {c.author} {c.mode === "demo" && "· DEMO"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <GitPullRequest size={15} /> Pull requests
          </h2>
          <div className="space-y-3">
            {pulls.map((p) => (
              <a key={p.number} href={p.url} target="_blank" rel="noreferrer" className="block text-sm hover:underline">
                <span className="font-medium text-slate-700">#{p.number} {p.title}</span>
                <div className="mt-0.5"><Badge value={p.state} /></div>
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Tag size={15} /> Releases
          </h2>
          <div className="space-y-3">
            {releases.length === 0 && <p className="text-sm text-slate-400">No releases yet.</p>}
            {releases.map((r) => (
              <a key={r.tag_name} href={r.url} target="_blank" rel="noreferrer" className="block text-sm hover:underline">
                <span className="font-medium text-slate-700">{r.name}</span>
                <p className="text-xs text-slate-400">{r.tag_name}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="GitHub connection settings"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={saveConnection}>Save</Button>
          </>
        }
      >
        <form onSubmit={saveConnection}>
          <TextField label="Repository owner" value={form.repo_owner} onChange={(e) => setForm({ ...form, repo_owner: e.target.value })} />
          <TextField label="Repository name" value={form.repo_name} onChange={(e) => setForm({ ...form, repo_name: e.target.value })} />
          <SelectField
            label="Mode"
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value })}
            options={[{ value: "demo", label: "Demo (seeded sample data)" }, { value: "real", label: "Real (live GitHub API)" }]}
          />
          {form.mode === "real" && (
            <TextField
              label="Personal access token (optional override)"
              type="password"
              placeholder="Uses server GITHUB_TOKEN env var if left blank"
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
            />
          )}
        </form>
      </Modal>
    </div>
  );
}
