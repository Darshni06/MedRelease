import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in to MedRelease" subtitle="Multi-organization SCM & release management for healthcare software teams.">
      <form onSubmit={submit}>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="you@example.com"
          />
        </label>
        <label className="mb-1 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="••••••••"
          />
        </label>
        <div className="mb-4 mt-1 text-right">
          <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-slate-800">
            Forgot password?
          </Link>
        </div>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Don't have an account? <Link to="/register" className="font-medium text-slate-800">Register</Link>
      </p>
      <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <p className="mb-1 font-medium text-slate-600">Sample accounts (password: Password123!)</p>
        <p>admin@medrelease.com — Admin, all organizations</p>
        <p>manager@medicare.com — Manager, MediCare Hospital</p>
        <p>developer@medicare.com — Developer, MediCare Hospital</p>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            MR
          </div>
          <span className="text-lg font-semibold text-slate-900">MedRelease</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>}
        {!subtitle && <div className="mb-4" />}
        {children}
      </div>
    </div>
  );
}
