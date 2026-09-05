import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, X, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useToast } from "../context/ToastContext";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";

export default function ConfigurationItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [ci, setCi] = useState(null);
  const [impact, setImpact] = useState(null);
  const [allCis, setAllCis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addDepId, setAddDepId] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const item = await api.getConfigurationItem(id);
      setCi(item);
      const [impactData, siblings] = await Promise.all([
        api.ciImpactAnalysis(id),
        api.listConfigurationItems(item.project_id),
      ]);
      setImpact(impactData);
      setAllCis(siblings.filter((c) => c.id !== item.id));
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

  const addDependency = async () => {
    if (!addDepId) return;
    try {
      await api.addDependency(id, Number(addDepId));
      toast.success("Dependency added");
      setAddDepId("");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeDependency = async (depId) => {
    try {
      await api.removeDependency(id, depId);
      toast.success("Dependency removed");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    try {
      await api.deleteConfigurationItem(id);
      toast.success("Configuration item deleted");
      navigate("/configuration-items");
    } catch (err) {
      toast.error(err.message);
      setDeleteOpen(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const depName = (depId) => allCis.find((c) => c.id === depId)?.name || `#${depId}`;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Configuration items", to: "/configuration-items" }, { label: ci.name }]} />
      <PageHeader
        title={ci.name}
        subtitle={ci.description || "No description"}
        actions={
          <>
            <Badge value={ci.status} />
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={15} />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Dependencies</h2>
          <p className="mb-3 text-xs text-slate-400">
            Configuration items that <span className="font-medium">{ci.name}</span> depends on. If they change,
            this item may need to change too.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {ci.dependency_ids.length === 0 && <span className="text-sm text-slate-400">No dependencies defined.</span>}
            {ci.dependency_ids.map((depId) => (
              <span key={depId} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                <Link to={`/configuration-items/${depId}`} className="hover:underline">{depName(depId)}</Link>
                <button onClick={() => removeDependency(depId)} className="text-slate-400 hover:text-rose-600">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={addDepId}
              onChange={(e) => setAddDepId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">Add a dependency...</option>
              {allCis.filter((c) => !ci.dependency_ids.includes(c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={addDependency}>
              <Plus size={14} /> Add
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Depended on by</h2>
          <div className="flex flex-wrap gap-2">
            {ci.dependent_ids.length === 0 && <span className="text-sm text-slate-400">Nothing depends on this item.</span>}
            {ci.dependent_ids.map((depId) => (
              <Link
                key={depId}
                to={`/configuration-items/${depId}`}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200"
              >
                {depName(depId)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Change Impact Analysis</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Direct dependencies</p>
            {impact.direct_dependencies.length === 0 ? (
              <p className="text-sm text-slate-400">None</p>
            ) : (
              <ul className="space-y-1.5">
                {impact.direct_dependencies.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 size={14} className="text-emerald-500" /> {d.name}
                    <Badge value={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Potentially affected</p>
            {impact.potentially_affected.length === 0 ? (
              <p className="text-sm text-slate-400">None</p>
            ) : (
              <ul className="space-y-1.5">
                {impact.potentially_affected.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <AlertTriangle size={14} className="text-amber-500" /> {d.name}
                    <Badge value={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Related change requests</p>
          {impact.related_change_requests.length === 0 ? (
            <p className="text-sm text-slate-400">None</p>
          ) : (
            <div className="space-y-1.5">
              {impact.related_change_requests.map((cr) => (
                <Link
                  key={cr.id}
                  to={`/change-requests/${cr.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span>{cr.code} — {cr.title}</span>
                  <Badge value={cr.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Current baseline</p>
          {impact.current_baseline ? (
            <Link to={`/baselines?project=${ci.project_id}`} className="text-sm text-slate-700 hover:underline">
              {impact.current_baseline.name} <Badge value={impact.current_baseline.status} className="ml-2" />
            </Link>
          ) : (
            <p className="text-sm text-slate-400">No approved baseline yet.</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete configuration item"
        message="This will remove the configuration item and any dependency links. This cannot be undone."
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
