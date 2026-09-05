const COLORS = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-slate-200 text-slate-600",
  PLANNING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  ON_HOLD: "bg-slate-200 text-slate-600",
  DEPRECATED: "bg-slate-200 text-slate-500",
  DRAFT: "bg-slate-100 text-slate-600",
  APPROVED: "bg-emerald-100 text-emerald-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-rose-100 text-rose-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  UAT: "bg-purple-100 text-purple-700",
  RELEASED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-slate-100 text-slate-600",
  FAILED: "bg-rose-100 text-rose-700",
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  CRITICAL: "bg-rose-100 text-rose-700",
  ADMIN: "bg-violet-100 text-violet-700",
  MANAGER: "bg-blue-100 text-blue-700",
  DEVELOPER: "bg-teal-100 text-teal-700",
  merged: "bg-violet-100 text-violet-700",
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
};

export default function Badge({ value, className = "" }) {
  const color = COLORS[value] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color} ${className}`}>
      {String(value).replaceAll("_", " ")}
    </span>
  );
}
