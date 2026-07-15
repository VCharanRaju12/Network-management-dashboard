import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function Account() {
  const { username } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Current password is incorrect.");
      } else {
        setError("Couldn't change your password — new password needs 8+ characters.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-md mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors">
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-lg bg-signal/10 border border-signal/30 flex items-center justify-center">
            <KeyRound size={16} className="text-signal" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Account</h1>
            <p className="text-sm text-muted">Signed in as {username}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold">Change password</h2>

          <div>
            <label className="block text-xs text-muted mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-signal/60"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-signal/60"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-signal/60"
            />
          </div>

          {error && <p className="text-sm text-offline">{error}</p>}
          {success && (
            <p className="flex items-center gap-1.5 text-sm text-online">
              <CheckCircle2 size={14} />
              Password changed successfully.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 text-sm font-semibold bg-signal text-base rounded-lg
                       hover:bg-signal/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Change password"}
          </button>
        </form>
      </main>
    </div>
  );
}
