import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, XCircle, AlertTriangle, GitFork } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { TextAreaField, TextField, SelectField } from "../components/FormField";

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED"];

export default function ChangeRequestDetail() {
  const { id } = useParams();
  const { user, currentOrgId } = useAuth();
  const toast = useToast();
  const [cr, setCr] = useState(null);
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approveOpen, setApproveOpen] = useState(null); // "APPROVED" | "REJECTED" | null
  const [comments, setComments] = useState("");
  const [githubOpen, setGithubOpen] = useState(false);
  const [githubForm, setGithubForm] = useState({ github_pr_number: "", github_pr_url: "", github_pr_state: "open" });
  const [statusUpdating, setStatusUpdating] = useState(false);

  const membership = user?.memberships?.find((m) => m.organization_id === currentOrgId);
  const canApprove = user?.is_admin || membership?.role === "MANAGER";

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const item = await api.getChangeRequest(id);
      setCr(item);
      setGithubForm({
        github_pr_number: item.github_pr_number || "",
        github_pr_url: item.github_pr_url || "",
        github_pr_state: item.github_pr_state || "open",
      });
      setImpact(await api.crImpactAnalysis(id));
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

  const submitApproval = async () => {
    try {
      await api.approveChangeRequest(id, { decision: approveOpen, comments });
      toast.success(`Change request ${approveOpen.toLowerCase()}`);
      setApproveOpen(null);
      setComments("");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateStatus = async (status) => {
    setStatusUpdating(true);
    try {
      await api.updateChangeRequest(id, { status });
      toast.success("Status updated");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const saveGithub = async (e) => {
    e.preventDefault();
    try {
      await api.updateChangeRequest(id, {
        github_pr_number: githubForm.github_pr_number ? Number(githubForm.github_pr_number) : null,
        github_pr_url: githubForm.github_pr_url || null,
        github_pr_state: githubForm.github_pr_state || null,
      });
      toast.success("GitHub PR link updated");
      setGithubOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Change requests", to: "/change-requests" }, { label: cr.code }]} />
      <PageHeader
        title={`${cr.code} — ${cr.title}`}
        subtitle={`On ${cr.ci_name} · Requested by ${cr.requested_by_name}`}
        actions={
          <>
            <Badge value={cr.priority} />
            <Badge value={cr.status} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Description</h2>
            <p className="text-sm text-slate-600">{cr.description || "No description provided."}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Change Impact Analysis</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Direct dependencies</p>
                {impact.direct_dependencies.length === 0 ? (
                  <p className="text-sm text-slate-400">None</p>
                ) : (
                  impact.direct_dependencies.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
                      <CheckCircle2 size={13} className="text-emerald-500" /> {d.name}
                    </div>
                  ))
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Potentially affected</p>
                {impact.potentially_affected.length === 0 ? (
                  <p className="text-sm text-slate-400">None</p>
                ) : (
                  impact.potentially_affected.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
                      <AlertTriangle size={13} className="text-amber-500" /> {d.name}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Related change requests</p>
              {impact.related_change_requests.filter((r) => r.id !== cr.id).length === 0 ? (
                <p className="text-sm text-slate-400">None</p>
              ) : (
                impact.related_change_requests.filter((r) => r.id !== cr.id).map((r) => (
                  <Link key={r.id} to={`/change-requests/${r.id}`} className="block py-0.5 text-sm text-slate-700 hover:underline">
                    {r.code} — {r.title}
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">GitHub Pull Request</h2>
              <Button variant="secondary" onClick={() => setGithubOpen(true)}>
                <GitFork size={14} /> {cr.github_pr_number ? "Update link" : "Link PR"}
              </Button>
            </div>
            {cr.github_pr_number ? (
              <a href={cr.github_pr_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-700 hover:underline">
                PR #{cr.github_pr_number} <Badge value={cr.github_pr_state} />
              </a>
            ) : (
              <p className="text-sm text-slate-400">Not linked to a pull request yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Status</h2>
            <SelectField
              label="Update status"
              value={cr.status}
              disabled={statusUpdating}
              onChange={(e) => updateStatus(e.target.value)}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>

          {canApprove && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Approval</h2>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setApproveOpen("APPROVED")}>
                  <CheckCircle2 size={15} /> Approve
                </Button>
                <Button variant="danger" className="flex-1" onClick={() => setApproveOpen("REJECTED")}>
                  <XCircle size={15} /> Reject
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Approval history</h2>
            {cr.approvals.length === 0 ? (
              <p className="text-sm text-slate-400">No approvals recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {cr.approvals.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Badge value={a.decision} />
                      <span className="text-slate-600">{a.approver_name}</span>
                    </div>
                    {a.comments && <p className="mt-1 text-xs text-slate-500">{a.comments}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={!!approveOpen}
        onClose={() => setApproveOpen(null)}
        title={approveOpen === "APPROVED" ? "Approve change request" : "Reject change request"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproveOpen(null)}>Cancel</Button>
            <Button variant={approveOpen === "REJECTED" ? "danger" : "primary"} onClick={submitApproval}>
              Confirm {approveOpen?.toLowerCase()}
            </Button>
          </>
        }
      >
        <TextAreaField label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} />
      </Modal>

      <Modal
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        title="Link GitHub pull request"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGithubOpen(false)}>Cancel</Button>
            <Button onClick={saveGithub}>Save</Button>
          </>
        }
      >
        <form onSubmit={saveGithub}>
          <TextField
            label="PR number"
            type="number"
            value={githubForm.github_pr_number}
            onChange={(e) => setGithubForm({ ...githubForm, github_pr_number: e.target.value })}
          />
          <TextField
            label="PR URL"
            value={githubForm.github_pr_url}
            onChange={(e) => setGithubForm({ ...githubForm, github_pr_url: e.target.value })}
          />
          <SelectField
            label="State"
            value={githubForm.github_pr_state}
            onChange={(e) => setGithubForm({ ...githubForm, github_pr_state: e.target.value })}
            options={["open", "merged", "closed"].map((s) => ({ value: s, label: s }))}
          />
        </form>
      </Modal>
    </div>
  );
}
