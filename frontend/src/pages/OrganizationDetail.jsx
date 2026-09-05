import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Trash2, Power, PowerOff } from "lucide-react";
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
import ConfirmDialog from "../components/ConfirmDialog";
import { TextField, SelectField } from "../components/FormField";

const ROLES = ["ADMIN", "MANAGER", "DEVELOPER"];

export default function OrganizationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: "", role: "DEVELOPER" });
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [o, m] = await Promise.all([api.getOrganization(id), api.listMembers(id)]);
      setOrg(o);
      setMembers(m);
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

  const addMember = async (e) => {
    e.preventDefault();
    try {
      await api.addMember(id, form);
      toast.success("Member added");
      setAddOpen(false);
      setForm({ email: "", role: "DEVELOPER" });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const changeRole = async (membershipId, role) => {
    try {
      await api.updateMember(id, membershipId, { role });
      toast.success("Role updated");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmRemove = async () => {
    try {
      await api.removeMember(id, removeTarget.id);
      toast.success("Member removed");
      setRemoveTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async () => {
    try {
      if (org.status === "ACTIVE") {
        await api.deactivateOrganization(id);
      } else {
        await api.activateOrganization(id);
      }
      toast.success("Organization status updated");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Organizations", to: "/organizations" }, { label: org.name }]} />
      <PageHeader
        title={org.name}
        subtitle={org.description}
        actions={
          user?.is_admin && (
            <Button variant="secondary" onClick={toggleStatus}>
              {org.status === "ACTIVE" ? <PowerOff size={15} /> : <Power size={15} />}
              {org.status === "ACTIVE" ? "Deactivate" : "Activate"}
            </Button>
          )
        }
      />

      <div className="mb-6 flex gap-3">
        <Badge value={org.status} />
        <span className="text-sm text-slate-500">{org.project_count} projects</span>
        <span className="text-sm text-slate-500">{org.member_count} members</span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Members</h2>
          {user?.is_admin && (
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus size={15} /> Add member
            </Button>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {members.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400">No members yet.</p>}
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-700">{m.user_name || m.user_email || `User #${m.user_id}`}</span>
              {m.user_email && <span className="text-xs text-slate-400 ml-2">{m.user_email}</span>}
              <div className="flex items-center gap-3">
                {user?.is_admin ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <Badge value={m.role} />
                )}
                {user?.is_admin && (
                  <button onClick={() => setRemoveTarget(m)} className="text-slate-400 hover:text-rose-600">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add member"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addMember}>Add</Button>
          </>
        }
      >
        <form onSubmit={addMember}>
          <TextField
            label="User email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="The user must already have a MedRelease account"
          />
          <SelectField
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ROLES.map((r) => ({ value: r, label: r }))}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove member"
        message="This user will lose access to this organization's data."
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
