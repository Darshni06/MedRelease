import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import Badge from "../components/Badge";

export default function Profile() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader title="Profile & Settings" subtitle="Your MedRelease account details." />

      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            {user?.full_name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{user?.full_name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">System role</span>
            <span>{user?.is_admin ? <Badge value="ADMIN" /> : "Standard user"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Member since</span>
            <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Organization memberships</p>
          <div className="flex flex-wrap gap-2">
            {user?.memberships?.length ? (
              user.memberships.map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {m.organization_name} <Badge value={m.role} />
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-400">No memberships yet. Ask an admin to add you to an organization.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
