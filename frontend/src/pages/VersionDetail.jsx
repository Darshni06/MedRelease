import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Rocket, Plus, GitFork, X } from "lucide-react";
import { api } from "../services/api";
import { useToast } from "../context/ToastContext";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { SelectField, TextField, TextAreaField } from "../components/FormField";

const ENVIRONMENTS = ["DEVELOPMENT", "TESTING", "UAT", "PRODUCTION"];
const DEPLOY_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"];

export default function VersionDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [version, setVersion] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [allCrs, setAllCrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attachId, setAttachId] = useState("");
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployForm, setDeployForm] = useState({ environment: "DEVELOPMENT", status: "PENDING", notes: "" });
  const [githubOpen, setGithubOpen] = useState(false);
  const [githubForm, setGithubForm] = useState({ github_release_tag: "", github_release_url: "", github_release_name: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const v = await api.getVersion(id);
      setVersion(v);
      setGithubForm({
        github_release_tag: v.github_release_tag || "",
        github_release_url: v.github_release_url || "",
        github_release_name: v.github_release_name || "",
      });
      const [r, d, crs] = await Promise.all([
        api.releaseReadiness(id),
        api.listDeployments(id),
        api.listChangeRequests(v.project_id),
      ]);
      setReadiness(r);
      setDeployments(d);
      setAllCrs(crs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleFlag = async (field, value) => {
    try {
      await api.updateVersion(id, { [field]: value });
      toast.success("Version updated");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const attachCr = async () => {
    if (!attachId) return;
    try {
      await api.attachChangeRequest(id, Number(attachId));
      toast.success("Change request attached");
      setAttachId("");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const detachCr = async (crId) => {
    try {
      await api.detachChangeRequest(id, crId);
      toast.success("Change request detached");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const createDeployment = async (e) => {
    e.preventDefault();
    try {
      await api.createDeployment({ ...deployForm, version_id: Number(id) });
      toast.success("Deployment recorded");
      setDeployOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateDeploymentStatus = async (deploymentId, status) => {
    try {
      await api.updateDeployment(deploymentId, { status });
      toast.success("Deployment updated");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveGithub = async (e) => {
    e.preventDefault();
    try {
      await api.updateVersion(id, githubForm);
      toast.success("GitHub release link updated");
      setGithubOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const attachedIds = new Set(version.change_request_ids);
  const attachedCrs = allCrs.filter((c) => attachedIds.has(c.id));
  const availableCrs = allCrs.filter((c) => !attachedIds.has(c.id));

  return (
    <div>
      <Breadcrumbs items={[{ label: "Versions", to: "/versions" }, { label: version.version_number }]} />
      <PageHeader
        title={`Version ${version.version_number}`}
        subtitle={version.description}
        actions={<Badge value={version.status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className={`rounded-xl border p-5 ${readiness.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="mb-3 flex items-center gap-2">
              <Rocket size={18} className={readiness.ready ? "text-emerald-600" : "text-amber-600"} />
              <h2 className="text-sm font-semibold text-slate-800">Release Readiness Check</h2>
            </div>
            <ul className="mb-4 space-y-1.5">
              {readiness.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-sm">
                  {c.passed ? (
                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle size={15} className="mt-0.5 flex-shrink-0 text-amber-600" />
                  )}
                  <span className={c.passed ? "text-slate-700" : "text-slate-600"}>
                    {c.label}
                    {!c.passed && c.detail && <span className="text-slate-400"> — {c.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${readiness.ready ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>
              {readiness.ready ? "✅ READY FOR PRODUCTION" : `⚠ NOT READY — ${readiness.blockers[0]}`}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Manual checklist</h2>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={version.testing_completed}
                  onChange={(e) => toggleFlag("testing_completed", e.target.checked)}
                />
                Testing completed
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={version.uat_completed}
                  onChange={(e) => toggleFlag("uat_completed", e.target.checked)}
                />
                UAT completed
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Change requests in this version</h2>
            <div className="mb-3 space-y-2">
              {attachedCrs.length === 0 && <p className="text-sm text-slate-400">No change requests attached yet.</p>}
              {attachedCrs.map((cr) => (
                <div key={cr.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <Link to={`/change-requests/${cr.id}`} className="hover:underline">{cr.code} — {cr.title}</Link>
                  <div className="flex items-center gap-2">
                    <Badge value={cr.status} />
                    <button onClick={() => detachCr(cr.id)} className="text-slate-400 hover:text-rose-600">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <select
                value={attachId}
                onChange={(e) => setAttachId(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                <option value="">Attach a change request...</option>
                {availableCrs.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                ))}
              </select>
              <Button variant="secondary" onClick={attachCr}><Plus size={14} /> Attach</Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">GitHub Release</h2>
              <Button variant="secondary" onClick={() => setGithubOpen(true)}>
                <GitFork size={14} /> {version.github_release_tag ? "Update link" : "Link release"}
              </Button>
            </div>
            {version.github_release_tag ? (
              <a href={version.github_release_url} target="_blank" rel="noreferrer" className="text-sm text-slate-700 hover:underline">
                {version.github_release_name} ({version.github_release_tag})
              </a>
            ) : (
              <p className="text-sm text-slate-400">Not linked to a GitHub release yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Deployments</h2>
              <Button variant="secondary" onClick={() => setDeployOpen(true)}>
                <Plus size={14} />
              </Button>
            </div>
            <div className="space-y-3">
              {deployments.length === 0 && <p className="text-sm text-slate-400">No deployments tracked yet.</p>}
              {deployments.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{d.environment}</span>
                    <Badge value={d.status} />
                  </div>
                  <select
                    value={d.status}
                    onChange={(e) => updateDeploymentStatus(d.id, e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    {DEPLOY_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        title="Record deployment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeployOpen(false)}>Cancel</Button>
            <Button onClick={createDeployment}>Save</Button>
          </>
        }
      >
        <form onSubmit={createDeployment}>
          <SelectField
            label="Environment"
            value={deployForm.environment}
            onChange={(e) => setDeployForm({ ...deployForm, environment: e.target.value })}
            options={ENVIRONMENTS.map((e) => ({ value: e, label: e }))}
          />
          <SelectField
            label="Status"
            value={deployForm.status}
            onChange={(e) => setDeployForm({ ...deployForm, status: e.target.value })}
            options={DEPLOY_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <TextAreaField label="Notes" value={deployForm.notes} onChange={(e) => setDeployForm({ ...deployForm, notes: e.target.value })} />
        </form>
      </Modal>

      <Modal
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        title="Link GitHub release"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGithubOpen(false)}>Cancel</Button>
            <Button onClick={saveGithub}>Save</Button>
          </>
        }
      >
        <form onSubmit={saveGithub}>
          <TextField label="Release tag" placeholder="v2.5.0" value={githubForm.github_release_tag} onChange={(e) => setGithubForm({ ...githubForm, github_release_tag: e.target.value })} />
          <TextField label="Release name" value={githubForm.github_release_name} onChange={(e) => setGithubForm({ ...githubForm, github_release_name: e.target.value })} />
          <TextField label="Release URL" value={githubForm.github_release_url} onChange={(e) => setGithubForm({ ...githubForm, github_release_url: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
