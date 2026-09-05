import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";

export default function AuditLogs() {
  const { currentOrgId } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .listAuditLogs({ organization_id: currentOrgId || undefined })
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Complete, backend-recorded history of all actions taken in MedRelease." />
      <DataTable
        columns={[
          {
            key: "created_at",
            label: "When",
            sortable: true,
            render: (l) => (
              <span className="flex items-center gap-2 text-slate-600">
                <History size={13} className="text-slate-400" /> {new Date(l.created_at).toLocaleString()}
              </span>
            ),
          },
          { key: "user_name", label: "User" },
          { key: "action", label: "Action", render: (l) => <Badge value={l.action.split("_")[0]} /> },
          { key: "entity_type", label: "Entity" },
          { key: "details", label: "Details" },
        ]}
        rows={logs}
        searchKeys={["action", "entity_type", "details", "user_name"]}
        emptyMessage="No audit log entries yet."
      />
    </div>
  );
}
