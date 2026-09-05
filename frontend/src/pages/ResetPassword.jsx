import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import Button from "../components/Button";
import { AuthShell } from "./Login";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.resetPassword({ token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Set a new password">
      {done ? (
        <p className="text-sm text-emerald-600">Password reset. Redirecting to sign in...</p>
      ) : (
        <form onSubmit={submit}>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Reset token</span>
            <input
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-slate-400"
            />
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block font-medium text-slate-700">New password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </label>
          {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-slate-800">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
