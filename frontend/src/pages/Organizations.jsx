import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Building2 } from "lucide-react";
import { api } from "../services/api";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { TextField, TextAreaField } from "../components/FormField";

export default function Organizations() {
  const navigate = useNavigate();
  const toast = useToast();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setOrgs(await api.listOrganizations());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createOrganization(form);
      toast.success("Organization created");
      setModalOpen(false);
      setForm({ name: "", description: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Organizations"
        subtitle="Healthcare organizations using MedRelease to manage their software lifecycle."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> New organization
          </Button>
        }
      />

      <DataTable
        columns={[
          {
            key: "name",
            label: "Name",
            sortable: true,
            render: (o) => (
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <Building2 size={15} className="text-slate-400" /> {o.name}
              </span>
            ),
          },
          { key: "description", label: "Description" },
          { key: "project_count", label: "Projects", sortable: true },
          { key: "member_count", label: "Members", sortable: true },
          { key: "status", label: "Status", render: (o) => <Badge value={o.status} /> },
        ]}
        rows={orgs}
        searchKeys={["name", "description"]}
        onRowClick={(o) => navigate(`/organizations/${o.id}`)}
        emptyMessage="No organizations yet. Create one to get started."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New organization"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
          </>
        }
      >
        <form onSubmit={create}>
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
