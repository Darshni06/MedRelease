import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, ClipboardList } from "lucide-react";
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

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function ChangeRequests() {
  const navigate = useNavigate();
  const { user, currentOrgId } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const projectFilter = params.get("project") || "";

  const [projects, setProjects] = useState([]);
  const [cis, setCis] = useState([]);
  const [crs, setCrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", configuration_item_id: "", title: "", description: "", priority: "MEDIUM" });
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
        items = await api.listChangeRequests(projectFilter);
      } else {
        items = (await Promise.all(projectList.map((p) => api.listChangeRequests(p.id)))).flat();
      }
      setCrs(items);

      const activeProject = projectFilter || projectList[0]?.id;
      const ciList = activeProject ? await api.listConfigurationItems(activeProject) : [];
      setCis(ciList);
      setForm((f) => ({ ...f, project_id: activeProject || "", configuration_item_id: ciList[0]?.id || "" }));
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
      await api.createChangeRequest({
        ...form,
        project_id: Number(form.project_id),
        configuration_item_id: Number(form.configuration_item_id),
      });
      toast.success("Change request submitted");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onProjectChange = async (projectId) => {
    setForm((f) => ({ ...f, project_id: projectId }));
    const ciList = await api.listConfigurationItems(projectId);
    setCis(ciList);
    setForm((f) => ({ ...f, configuration_item_id: ciList[0]?.id || "" }));
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Change Requests"
        subtitle="Requests to modify software, with approval workflow and impact analysis."
        actions={
          <Button onClick={() => setModalOpen(true)} disabled={projects.length === 0}>
            <Plus size={16} /> New change request
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
            key: "code",
            label: "Code",
            sortable: true,
            render: (c) => (
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <ClipboardList size={15} className="text-slate-400" /> {c.code}
              </span>
            ),
          },
          { key: "title", label: "Title" },
          { key: "ci_name", label: "Configuration item" },
          { key: "priority", label: "Priority", render: (c) => <Badge value={c.priority} /> },
          { key: "status", label: "Status", render: (c) => <Badge value={c.status} /> },
        ]}
        rows={crs}
        searchKeys={["code", "title", "ci_name"]}
        onRowClick={(c) => navigate(`/change-requests/${c.id}`)}
        emptyMessage="No change requests yet."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New change request"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Submitting..." : "Submit"}</Button>
          </>
        }
      >
        <form onSubmit={create}>
          <SelectField
            label="Project"
            value={form.project_id}
            onChange={(e) => onProjectChange(e.target.value)}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <SelectField
            label="Configuration item"
            value={form.configuration_item_id}
            onChange={(e) => setForm({ ...form, configuration_item_id: e.target.value })}
            options={cis.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextField label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextAreaField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <SelectField
            label="Priority"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            options={PRIORITIES.map((p) => ({ value: p, label: p }))}
          />
        </form>
      </Modal>
    </div>
  );
}
