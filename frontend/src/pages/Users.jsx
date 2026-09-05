import { useEffect, useState } from "react";
import { Users as UsersIcon } from "lucide-react";
import { api } from "../services/api";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import Loading from "../components/Loading";
import ErrorState from "../components/ErrorState";
import Badge from "../components/Badge";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Users" subtitle="Everyone with a MedRelease account. Assign them to organizations from the Organization page." />
      <DataTable
        columns={[
          {
            key: "full_name",
            label: "Name",
            sortable: true,
            render: (u) => (
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <UsersIcon size={15} className="text-slate-400" /> {u.full_name}
              </span>
            ),
          },
          { key: "email", label: "Email" },
          {
            key: "is_admin",
            label: "System role",
            render: (u) => (u.is_admin ? <Badge value="ADMIN" /> : <span className="text-slate-400">Standard</span>),
          },
          {
            key: "memberships",
            label: "Organizations",
            render: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.memberships.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  u.memberships.map((m) => (
                    <span key={m.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {m.organization_name} ({m.role})
                    </span>
                  ))
                )}
              </div>
            ),
          },
          { key: "is_active", label: "Status", render: (u) => <Badge value={u.is_active ? "ACTIVE" : "INACTIVE"} /> },
        ]}
        rows={users}
        searchKeys={["full_name", "email"]}
        emptyMessage="No users yet."
      />
    </div>
  );
}
