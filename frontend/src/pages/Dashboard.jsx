import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Boxes, ClipboardList, Rocket, ArrowRight } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import Badge from "../components/Badge";

function StatCard({ icon: Icon, label, value, to }) {
  return (
    <Link to={to} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm">
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
          <Icon size={18} />
        </div>
        <ArrowRight size={14} className="text-slate-300" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </Link>
  );
}

export default function Dashboard() {
  const { user, currentOrgId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [cis, setCis] = useState([]);
  const [crs, setCrs] = useState([]);
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const orgId = user?.is_admin ? undefined : currentOrgId ?? undefined;
        const projectList = await api.listProjects(orgId);
        if (cancelled) return;
        setProjects(projectList);

        const relevantProjectIds = new Set(projectList.map((p) => p.id));
        const [allCis, allCrs, allVersions] = await Promise.all([
          Promise.all(projectList.map((p) => api.listConfigurationItems(p.id))).then((r) => r.flat()),
          Promise.all(projectList.map((p) => api.listChangeRequests(p.id))).then((r) => r.flat()),
          Promise.all(projectList.map((p) => api.listVersions(p.id))).then((r) => r.flat()),
        ]);
        if (cancelled) return;
        setCis(allCis.filter((c) => relevantProjectIds.has(c.project_id)));
        setCrs(allCrs);
        setVersions(allVersions);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrgId]);

  if (loading) return <Loading label="Loading dashboard..." />;

  const openCrs = crs.filter((c) => ["SUBMITTED", "IN_PROGRESS"].includes(c.status));
  const recentCrs = [...crs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(" ")[0]}`}
        subtitle="Here's what's happening across your software release lifecycle."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projects" value={projects.length} to="/projects" />
        <StatCard icon={Boxes} label="Configuration Items" value={cis.length} to="/configuration-items" />
        <StatCard icon={ClipboardList} label="Open change requests" value={openCrs.length} to="/change-requests" />
        <StatCard icon={Rocket} label="Versions tracked" value={versions.length} to="/versions" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Recent change requests</h2>
        </div>
        {recentCrs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">No change requests yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentCrs.map((cr) => (
              <Link
                key={cr.id}
                to={`/change-requests/${cr.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {cr.code} — {cr.title}
                  </p>
                  <p className="text-xs text-slate-400">{cr.ci_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={cr.priority} />
                  <Badge value={cr.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
