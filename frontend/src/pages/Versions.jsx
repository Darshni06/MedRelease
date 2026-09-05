import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Rocket } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { TextField, TextAreaField, SelectField } from "../components/FormField";

export default function Versions() {
  const navigate = useNavigate();
  const { user, currentOrgId } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const projectFilter = params.get("project") || "";

  const [projects, setProjects] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", version_number: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const orgId = user?.is_admin ? undefined : currentOrgId ?? undefined;
      const projectList = await api.listProjects(orgId);
      setProjects(projectList);
      let items;
      if (projectFilter) {
        items = await api.listVersions(projectFilter);
      } else {
        items = (await Promise.all(projectList.map((p) => api.listVersions(p.id)))).flat();
      }
      setVersions(items);
      setForm((f) => ({ ...f, project_id: projectFilter || projectList[0]?.id || "" }));
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
      await api.createVersion({ ...form, project_id: Number(form.project_id) });
      toast.success("Version created");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const projectName = (id) => projects.find((p) => p.id === id)?.name || "—";

  return (
    <div>
      <PageHeader
        title="Versions & Releases"
        subtitle="Software versions created from approved change requests, tracked through to release."
        actions={
          <Button onClick={() => setModalOpen(true)} disabled={projects.length === 0}>
            <Plus size={16} /> New version
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
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <DataTable
        columns={[
          {
            key: "version_number",
            label: "Version",
            sortable: true,
            render: (v) => (
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <Rocket size={15} className="text-slate-400" /> {v.version_number}
              </span>
            ),
          },
          { key: "project_id", label: "Project", render: (v) => projectName(v.project_id) },
          { key: "change_request_ids", label: "Change requests", render: (v) => v.change_request_ids.length },
          {
            key: "testing_completed",
            label: "Testing",
            render: (v) => (v.testing_completed ? <Badge value="APPROVED" /> : <Badge value="PENDING" />),
          },
          {
            key: "uat_completed",
            label: "UAT",
            render: (v) => (v.uat_completed ? <Badge value="APPROVED" /> : <Badge value="PENDING" />),
          },
          { key: "status", label: "Status", render: (v) => <Badge value={v.status} /> },
        ]}
        rows={versions}
        searchKeys={["version_number", "description"]}
        onRowClick={(v) => navigate(`/versions/${v.id}`)}
        emptyMessage="No versions yet."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New version"
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
          <TextField
            label="Version number"
            required
            placeholder="e.g. 2.5.0"
            value={form.version_number}
            onChange={(e) => setForm({ ...form, version_number: e.target.value })}
          />
          <TextAreaField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
}
