import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Boxes, Layers, ClipboardList, Rocket, GitFork, GitBranch } from "lucide-react";
import { api } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";

function LinkCard({ to, icon: Icon, title, value, hint }) {
  return (
    <Link to={to} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={16} />
        <span className="text-sm">{title}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </Link>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [org, setOrg] = useState(null);
  const [cis, setCis] = useState([]);
  const [baselines, setBaselines] = useState([]);
  const [crs, setCrs] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const p = await api.getProject(id);
        if (cancelled) return;
        setProject(p);
        const [o, ci, bl, cr, v] = await Promise.all([
          api.getOrganization(p.organization_id),
          api.listConfigurationItems(id),
          api.listBaselines(id),
          api.listChangeRequests(id),
          api.listVersions(id),
        ]);
        if (cancelled) return;
        setOrg(o);
        setCis(ci);
        setBaselines(bl);
        setCrs(cr);
        setVersions(v);
      } catch (err) {
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Projects", to: "/projects" },
          { label: project.name },
        ]}
      />
      <PageHeader
        title={project.name}
        subtitle={`${org?.name || ""} · ${project.description || "No description"}`}
        actions={<Badge value={project.status} />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <LinkCard to={`/configuration-items?project=${id}`} icon={Boxes} title="Configuration items" value={cis.length} />
        <LinkCard to={`/dependency-graph?project=${id}`} icon={GitBranch} title="Dependency graph" value="View" />
        <LinkCard to={`/baselines?project=${id}`} icon={Layers} title="Baselines" value={baselines.length} />
        <LinkCard to={`/change-requests?project=${id}`} icon={ClipboardList} title="Change requests" value={crs.length} />
        <LinkCard to={`/versions?project=${id}`} icon={Rocket} title="Versions" value={versions.length} />
      </div>

      <div className="mt-4">
        <LinkCard to={`/github?project=${id}`} icon={GitFork} title="GitHub integration" value="Manage" hint="Repository, PRs, commits, releases" />
      </div>
    </div>
  );
}
