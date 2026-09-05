import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import Button from "../components/Button";
import { AuthShell } from "./Login";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.forgotPassword({ email });
      setSent(true);
      if (res?.dev_reset_token) setDevToken(res.dev_reset_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll generate a reset link.">
      {sent ? (
        <div className="text-sm text-slate-600">
          <p>If that email exists, a reset token has been generated.</p>
          {devToken && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-1 font-medium">Development mode: token logged to server console.</p>
              <p className="break-all font-mono">{devToken}</p>
              <Link to={`/reset-password?token=${devToken}`} className="mt-2 inline-block font-medium text-amber-900 underline">
                Continue to reset password →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit}>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </label>
          {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-slate-800">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
