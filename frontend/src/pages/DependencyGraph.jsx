import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import { GitBranch } from "lucide-react";

const STATUS_COLOR = {
  ACTIVE: "#10b981",
  PLANNING: "#f59e0b",
  DEPRECATED: "#94a3b8",
};

function layoutNodes(nodes, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 70;
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2;
    return { ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

export default function DependencyGraph() {
  const { user, currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";

  const [projects, setProjects] = useState([]);
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const orgId = user?.is_admin ? undefined : currentOrgId ?? undefined;
        const projectList = await api.listProjects(orgId);
        if (cancelled) return;
        setProjects(projectList);
        const activeProject = projectId || projectList[0]?.id;
        if (activeProject) {
          const g = await api.dependencyGraph(activeProject);
          if (!cancelled) setGraph(g);
          if (!projectId && activeProject) setParams({ project: String(activeProject) });
        } else {
          setGraph({ nodes: [], edges: [] });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentOrgId]);

  const width = 720;
  const height = 480;
  const positioned = useMemo(() => (graph ? layoutNodes(graph.nodes, width, height) : []), [graph]);
  const posMap = useMemo(() => Object.fromEntries(positioned.map((n) => [n.id, n])), [positioned]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Dependency Graph"
        subtitle="Visualize how configuration items depend on each other within a project."
      />

      {projects.length > 0 && (
        <div className="mb-4">
          <select
            value={projectId}
            onChange={(e) => setParams({ project: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {!graph || graph.nodes.length === 0 ? (
        <EmptyState icon={GitBranch} title="No configuration items yet" message="Add configuration items to this project to see their dependency graph." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 520 }}>
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="20" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
              </marker>
            </defs>
            {graph.edges.map((e, i) => {
              const source = posMap[e.source];
              const target = posMap[e.target];
              if (!source || !target) return null;
              const dim = hovered && hovered !== e.source && hovered !== e.target;
              return (
                <line
                  key={i}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={dim ? "#e2e8f0" : "#94a3b8"}
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                />
              );
            })}
            {positioned.map((n) => {
              const dim = hovered && hovered !== n.id && !graph.edges.some(
                (e) => (e.source === hovered && e.target === n.id) || (e.target === hovered && e.source === n.id)
              );
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => navigate(`/configuration-items/${n.id}`)}
                  opacity={dim ? 0.35 : 1}
                >
                  <circle r={26} fill="white" stroke={STATUS_COLOR[n.status] || "#64748b"} strokeWidth={2.5} />
                  <circle r={4} fill={STATUS_COLOR[n.status] || "#64748b"} />
                  <text textAnchor="middle" y={44} fontSize={11} fill="#334155" fontWeight={500}>
                    {n.label.length > 16 ? n.label.slice(0, 14) + "…" : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Active</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Planning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Deprecated</span>
            <span className="ml-auto">Arrows point from an item to what it depends on. Click a node to view its impact analysis.</span>
          </div>
        </div>
      )}
    </div>
  );
}
