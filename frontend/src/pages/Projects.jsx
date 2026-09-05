import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderKanban } from "lucide-react";
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

const STATUSES = ["ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED"];

export default function Projects() {
  const navigate = useNavigate();
  const { user, currentOrgId } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ organization_id: "", name: "", description: "", status: "ACTIVE" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const orgId = user?.is_admin ? undefined : currentOrgId ?? undefined;
      const [p, o] = await Promise.all([api.listProjects(orgId), api.listOrganizations()]);
      setProjects(p);
      setOrgs(o);
      if (!form.organization_id && (currentOrgId || o[0]?.id)) {
        setForm((f) => ({ ...f, organization_id: currentOrgId || o[0]?.id }));
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
  }, [currentOrgId]);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createProject({ ...form, organization_id: Number(form.organization_id) });
      toast.success("Project created");
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

  const orgName = (id) => orgs.find((o) => o.id === id)?.name || "—";

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Software projects being developed and released."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> New project
          </Button>
        }
      />

      <DataTable
        columns={[
          {
            key: "name",
            label: "Name",
            sortable: true,
            render: (p) => (
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <FolderKanban size={15} className="text-slate-400" /> {p.name}
              </span>
            ),
          },
          { key: "organization_id", label: "Organization", render: (p) => orgName(p.organization_id) },
          { key: "description", label: "Description" },
          { key: "ci_count", label: "Config items", sortable: true },
          { key: "status", label: "Status", render: (p) => <Badge value={p.status} /> },
        ]}
        rows={projects}
        searchKeys={["name", "description"]}
        onRowClick={(p) => navigate(`/projects/${p.id}`)}
        emptyMessage="No projects yet."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New project"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
          </>
        }
      >
        <form onSubmit={create}>
          <SelectField
            label="Organization"
            value={form.organization_id}
            onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
            options={orgs.map((o) => ({ value: o.id, label: o.name }))}
          />
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextAreaField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
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
