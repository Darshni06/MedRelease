import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Layers } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { TextField, TextAreaField, SelectField } from "../components/FormField";

export default function Baselines() {
  const { user, currentOrgId } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const projectFilter = params.get("project") || "";

  const [projects, setProjects] = useState([]);
  const [baselines, setBaselines] = useState([]);
  const [cis, setCis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", name: "", description: "", ci_ids: [] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const orgId = user?.is_admin ? undefined : currentOrgId ?? undefined;
      const projectList = await api.listProjects(orgId);
      setProjects(projectList);
      const activeProject = projectFilter || projectList[0]?.id;
      let bl = [];
      let ciList = [];
      if (activeProject) {
        [bl, ciList] = await Promise.all([
          api.listBaselines(activeProject),
          api.listConfigurationItems(activeProject),
        ]);
      }
      setBaselines(bl);
      setCis(ciList);
      setForm((f) => ({ ...f, project_id: activeProject || "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter, currentOrgId]);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createBaseline({ ...form, project_id: Number(form.project_id) });
      toast.success("Baseline created");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCi = (ciId) => {
    setForm((f) => ({
      ...f,
      ci_ids: f.ci_ids.includes(ciId) ? f.ci_ids.filter((x) => x !== ciId) : [...f.ci_ids, ciId],
    }));
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Baselines"
        subtitle="Approved snapshots of configuration items used as a reference point for changes."
        actions={
          <Button onClick={() => setModalOpen(true)} disabled={!form.project_id}>
            <Plus size={16} /> New baseline
          </Button>
        }
      />

      {projects.length > 0 && (
        <div className="mb-4">
          <select
            value={projectFilter}
            onChange={(e) => setParams(e.target.value ? { project: e.target.value } : {})}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {baselines.length === 0 ? (
        <EmptyState icon={Layers} title="No baselines yet" message="Create a baseline to snapshot approved configuration for this project." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {baselines.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">{b.name}</h3>
                <Badge value={b.status} />
              </div>
              <p className="mb-3 text-sm text-slate-500">{b.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {b.items.map((i) => (
                  <span key={i.configuration_item_id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {i.ci_name} v{i.version_snapshot}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New baseline"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
          </>
        }
      >
        <form onSubmit={create}>
          <SelectField
            label="Project"
            value={form.project_id}
            onChange={(e) => setForm({ ...form, project_id: e.target.value })}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextAreaField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <p className="mb-1 text-sm font-medium text-slate-700">Include configuration items</p>
          <div className="mb-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-100 p-2">
            {cis.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => toggleCi(c.id)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  form.ci_ids.includes(c.id) ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </form>
      </Modal>
    </div>
  );
}
