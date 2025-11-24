import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const ProfilePage: React.FC = () => {
  const { user, updateProfile, logout, loading } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  });

  const deriveAccountStatus = () => {
    const statusValue = user?.is_active;
    if (typeof statusValue === 'boolean') {
      return statusValue ? 'Active' : 'Inactive';
    }
    return 'Active';
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (loading && !user) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-gray-600">Not authenticated.</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    try {
      setSaving(true);
      await updateProfile(form);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Role</p>
          <p className="text-lg font-semibold capitalize">{user.role}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Email</p>
          <p className="text-lg font-semibold break-all">{user.email}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Account Status</p>
          <p className="text-lg font-semibold">{deriveAccountStatus()}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Edit Details</h2>
        {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        {success && <div className="text-xs text-green-600 bg-green-50 p-2 rounded">Profile updated.</div>}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
            <input
              name="first_name"
              value={form.first_name}
              onChange={handleChange}
              className="input w-full"
              type="text"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
            <input
              name="last_name"
              value={form.last_name}
              onChange={handleChange}
              className="input w-full"
              type="text"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="input w-full"
              type="tel"
              placeholder="e.g. +27828167854"
            />
        </div>
        <div className="flex gap-3">
          <Button type="submit" loading={saving}>Save Changes</Button>
          <Button type="button" variant="outline" onClick={logout}>Logout</Button>
        </div>
      </form>
      <div className="mt-8 text-xs text-gray-500">
        Last login: {user.last_login ? new Date(user.last_login).toLocaleString() : 'N/A'} • Created {new Date(user.created_at).toLocaleDateString()}
      </div>
    </div>
  );
};

export default ProfilePage;
