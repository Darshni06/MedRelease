import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Boxes,
  GitBranch,
  Layers,
  ClipboardList,
  Rocket,
  GitFork,
  Users,
  History,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/organizations", label: "Organizations", icon: Building2, adminOnly: true },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/configuration-items", label: "Configuration Items", icon: Boxes },
  { to: "/dependency-graph", label: "Dependency Graph", icon: GitBranch },
  { to: "/baselines", label: "Baselines", icon: Layers },
  { to: "/change-requests", label: "Change Requests", icon: ClipboardList },
  { to: "/versions", label: "Versions & Releases", icon: Rocket },
  { to: "/github", label: "GitHub Integration", icon: GitFork },
  { to: "/audit-logs", label: "Audit Logs", icon: History },
  { to: "/users", label: "Users", icon: Users, adminOnly: true },
];

export default function Layout() {
  const { user, logout, currentOrgId, selectOrg } = useAuth();
  const navigate = useNavigate();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  const memberships = user?.memberships || [];
  const currentMembership = memberships.find((m) => m.organization_id === currentOrgId);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            MR
          </div>
          <span className="text-base font-semibold text-slate-900">MedRelease</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.filter((item) => !item.adminOnly || user?.is_admin).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <Settings size={17} />
            Profile & Settings
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={17} />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="relative">
            <button
              onClick={() => setOrgMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Building2 size={15} />
              {currentMembership
                ? currentMembership.organization_name
                : user?.is_admin
                ? "All Organizations"
                : "Select organization"}
              <ChevronDown size={14} />
            </button>
            {orgMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {memberships.map((m) => (
                  <button
                    key={m.organization_id}
                    onClick={() => {
                      selectOrg(m.organization_id);
                      setOrgMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      m.organization_id === currentOrgId ? "font-semibold text-slate-900" : "text-slate-600"
                    }`}
                  >
                    {m.organization_name}
                    <span className="text-xs text-slate-400">{m.role}</span>
                  </button>
                ))}
                {user?.is_admin && (
                  <button
                    onClick={() => {
                      selectOrg(null);
                      setOrgMenuOpen(false);
                    }}
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    All Organizations (admin)
                  </button>
                )}
                {memberships.length === 0 && !user?.is_admin && (
                  <div className="px-3 py-2 text-sm text-slate-400">No organization memberships yet</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user?.full_name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {user?.full_name?.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
