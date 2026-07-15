import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import { api, ApiError, type AppUser } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Pagination } from "../components/Pagination";

const PAGE_SIZE = 20;

export function Users() {
  const { username: currentUsername } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listUsers(offset, PAGE_SIZE);
      setUsers(data);
    } catch {
      setError("Couldn't load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  async function toggleActive(user: AppUser) {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      load();
    } catch {
      setError(`Couldn't update ${user.username}.`);
    }
  }

  async function toggleRole(user: AppUser) {
    const newRole = user.role === "admin" ? "viewer" : "admin";
    try {
      await api.updateUser(user.id, { role: newRole });
      load();
    } catch {
      setError(`Couldn't update ${user.username}.`);
    }
  }

  async function handleDelete(user: AppUser) {
    if (!confirm(`Delete user "${user.username}"? This can't be undone.`)) return;
    try {
      await api.deleteUser(user.id);
      load();
    } catch {
      setError(`Couldn't delete ${user.username}.`);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} />
            Back to devices
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold">Users</h1>
            <p className="text-sm text-muted mt-0.5">Manage who can access the dashboard.</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-signal text-base rounded-lg
                         hover:bg-signal/90 transition-colors"
            >
              <UserPlus size={16} />
              New user
            </button>
          )}
        </div>

        {showForm && (
          <CreateUserForm
            onCreated={() => {
              setShowForm(false);
              load();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {loading && <p className="text-sm text-muted">Loading…</p>}
        {error && <p className="text-sm text-offline mb-4">{error}</p>}

        {!loading && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted text-left">
                  <th className="px-4 py-2.5 font-medium">Username</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {user.username}
                      {user.username === currentUsername && (
                        <span className="text-muted font-normal"> (you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{user.email}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRole(user)}
                        disabled={user.username === currentUsername}
                        className="capitalize bg-base border border-border rounded px-2 py-0.5 text-xs
                                   hover:border-signal/50 transition-colors disabled:opacity-40 disabled:hover:border-border"
                        title={
                          user.username === currentUsername
                            ? "Can't change your own role"
                            : `Click to make ${user.role === "admin" ? "viewer" : "admin"}`
                        }
                      >
                        {user.role}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(user)}
                        disabled={user.username === currentUsername}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors disabled:opacity-40 ${
                          user.is_active
                            ? "text-online border-online/30 bg-online/10"
                            : "text-offline border-offline/30 bg-offline/10"
                        }`}
                      >
                        {user.is_active ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={user.username === currentUsername}
                        className="text-muted hover:text-offline transition-colors disabled:opacity-30 disabled:hover:text-muted"
                        title="Delete user"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={users.length}
            onPrev={() => setOffset((o) => Math.max(o - PAGE_SIZE, 0))}
            onNext={() => setOffset((o) => o + PAGE_SIZE)}
          />
        )}
      </main>
    </div>
  );
}

function CreateUserForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createUser({ username, email, password, role });
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Couldn't create user.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4"
    >
      <h2 className="text-sm font-semibold">New user</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-signal/60"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-offline">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm text-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold bg-signal text-base rounded-lg
                     hover:bg-signal/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  );
}
