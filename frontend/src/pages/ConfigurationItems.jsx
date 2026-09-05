import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Boxes } from "lucide-react";
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

const STATUSES = ["ACTIVE", "PLANNING", "DEPRECATED"];

export default function ConfigurationItems() {
  const navigate = useNavigate();
  const { user, currentOrgId } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const projectFilter = params.get("project") || "";

  const [projects, setProjects] = useState([]);
  const [cis, setCis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", name: "", description: "", status: "ACTIVE", version: "1.0" });
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
        items = await api.listConfigurationItems(projectFilter);
      } else {
        items = (await Promise.all(projectList.map((p) => api.listConfigurationItems(p.id)))).flat();
      }
      setCis(items);
      if (!form.project_id) setForm((f) => ({ ...f, project_id: projectFilter || projectList[0]?.id || "" }));
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
      await api.createConfigurationItem({ ...form, project_id: Number(form.project_id) });
      toast.success("Configuration item created");
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
        title="Configuration Items"
        subtitle="Software modules and components tracked across your projects."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> New configuration item
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
            key: "name",
            label: "Name",
            sortable: true,
            render: (c) => (
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <Boxes size={15} className="text-slate-400" /> {c.name}
              </span>
            ),
          },
          { key: "project_id", label: "Project", render: (c) => projectName(c.project_id) },
          { key: "version", label: "Version" },
          { key: "dependency_ids", label: "Depends on", render: (c) => c.dependency_ids.length },
          { key: "status", label: "Status", render: (c) => <Badge value={c.status} /> },
        ]}
        rows={cis}
        searchKeys={["name", "description"]}
        onRowClick={(c) => navigate(`/configuration-items/${c.id}`)}
        emptyMessage="No configuration items yet."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New configuration item"
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
          <TextField label="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          <SelectField
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </form>
      </Modal>
    </div>
  );
}
