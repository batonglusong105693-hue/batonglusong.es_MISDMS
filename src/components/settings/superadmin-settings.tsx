"use client";

import { useEffect, useState } from "react";
import { Check, Lock, Save, Settings, ShieldCheck, UserCog, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  position: string | null;
  employeeNumber: string | null;
  phoneNumber: string | null;
  address: string | null;
  bio: string | null;
  status: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  isAdviser: boolean;
}

const defaultProfile = {
  name: "",
  email: "",
  department: "",
  position: "",
  employeeNumber: "",
  phoneNumber: "",
  address: "",
  bio: "",
};

export function SuperadminSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState(defaultProfile);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "TEACHER", department: "", status: "ACTIVE" });
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!open || !session?.user?.id) return;
    const loadAll = async () => {
      setLoading(true);
      try {
        const profileRes = await fetch(`/api/users/${session.user.id}/profile`);
        const profileData = await profileRes.json();
        if (!profileRes.ok) throw new Error(profileData.error || "Failed to load settings");

        setProfile(profileData);
        setForm({
          name: profileData.name || "",
          email: profileData.email || "",
          department: profileData.department || "",
          position: profileData.position || "",
          employeeNumber: profileData.employeeNumber || "",
          phoneNumber: profileData.phoneNumber || "",
          address: profileData.address || "",
          bio: profileData.bio || "",
        });

        if (isSuperAdmin) {
          const usersRes = await fetch("/api/faculty");
          if (usersRes.ok) {
            const data = await usersRes.json();
            setUsers(Array.isArray(data) ? data : (data?.data ?? []));
          }
        }
      } catch (error) {
        showToast("error", "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [open, isSuperAdmin, session?.user?.id, showToast]);

  const handleProfileSave = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, password: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setProfile(data);
      showToast("success", "Profile updated successfully");
    } catch (error: any) {
      showToast("error", error.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      showToast("error", "New password must be at least 6 characters");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("error", "Passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          password: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast("success", "Password updated successfully");
    } catch (error: any) {
      showToast("error", error.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const openUserEditor = (user: UserRecord) => {
    setSelectedUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
      status: "ACTIVE",
    });
  };

  const handleUserSave = async () => {
    if (!selectedUserId) return;
    setSavingUser(true);
    try {
      const res = await fetch("/api/faculty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedUserId, ...userForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      setUsers((prev) => prev.map((u) => (u.id === selectedUserId ? { ...u, ...data } : u)));
      setSelectedUserId(null);
      showToast("success", "User updated successfully");
    } catch (error: any) {
      showToast("error", error.message || "Failed to update user");
    } finally {
      setSavingUser(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Settings</h2>
              <p className="text-sm text-slate-500">Manage account and access</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center text-slate-500">Loading...</div>
        ) : (
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_1.8fr]">
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-700 text-white">
                    <UserCog className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{profile?.name || session?.user?.name}</p>
                    <p className="text-sm text-slate-500">{profile?.email || session?.user?.email}</p>
                  </div>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {profile?.role || session?.user?.role}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-4 font-semibold text-slate-900">Profile</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                    <input value={form.department ?? ""} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Position</label>
                    <input value={form.position ?? ""} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <button type="button" onClick={handleProfileSave} disabled={savingProfile} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                    {savingProfile ? "Saving..." : "Save Profile"}
                    {!savingProfile && <Save className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><Lock className="h-4 w-4" /> Change Password</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
                    <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
                    <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <button type="button" onClick={handlePasswordSave} disabled={savingPassword} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                    {savingPassword ? "Updating..." : "Update Password"}
                    {!savingPassword && <Check className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">User Management</h3>
                {isSuperAdmin && (
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Superadmin</span>
                )}
              </div>

              {!isSuperAdmin ? (
                <p className="text-sm text-slate-500">Only the superadmin can manage other user accounts.</p>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {users.map((user) => (
                          <tr key={user.id} className="align-middle">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-800">{user.name}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{user.role}</td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => openUserEditor(user)} className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">Edit</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedUserId && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-900">Edit User</h4>
                        <button type="button" onClick={() => setSelectedUserId(null)} className="text-slate-500 hover:text-slate-700">Close</button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                          <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                          <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                          <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                            <option value="SUPER_ADMIN">Super Admin</option>
                            <option value="PRINCIPAL">Principal</option>
                            <option value="ADMIN_OFFICER">Administrative Officer</option>
                            <option value="ADMIN_SUPPORT">Administrative Support Staff</option>
                            <option value="TEACHER">Teacher</option>
                            <option value="ADVISER">Adviser</option>
                            <option value="ADMIN_OFFICER">Admin Officer</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                          <select value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="SUSPENDED">Suspended</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                          <input value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                        </div>
                      </div>
                      <button type="button" onClick={handleUserSave} disabled={savingUser} className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                        {savingUser ? "Saving..." : "Save User"}
                        {!savingUser && <Save className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
