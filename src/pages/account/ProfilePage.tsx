import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const ProfilePage: React.FC = () => {
  const { user, logout, loading } = useAuth();

  const formatDate = (
    value: string | Date | null | undefined,
    mode: 'datetime' | 'date' = 'datetime'
  ) => {
    if (!value) {
      return 'N/A';
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'N/A';
    }
    return mode === 'date' ? parsed.toLocaleDateString() : parsed.toLocaleString();
  };

  const deriveAccountStatus = () => {
    const statusValue = user?.is_active;
    if (typeof statusValue === 'boolean') {
      return statusValue ? 'Active' : 'Inactive';
    }
    return 'Active';
  };
  const lastLoginDisplay = formatDate(user?.last_login);
  const createdDisplay = formatDate(user?.created_at, 'date');

  if (loading && !user) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  }

  if (!user) {
    return <div className="p-6 text-sm text-gray-600">Not authenticated.</div>;
  }

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
      <div className="space-y-4 bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Personal Details</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
            <input
              value={user.first_name || ''}
              readOnly
              className="input w-full bg-gray-50 cursor-not-allowed"
              type="text"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
            <input
              value={user.last_name || ''}
              readOnly
              className="input w-full bg-gray-50 cursor-not-allowed"
              type="text"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
          <input
            value={user.phone || ''}
            readOnly
            className="input w-full bg-gray-50 cursor-not-allowed"
            type="tel"
          />
        </div>
        <div className="flex justify-start">
          <Button type="button" variant="outline" onClick={logout}>Logout</Button>
        </div>
      </div>
      <div className="mt-8 text-xs text-gray-500">
        Last login: {lastLoginDisplay}
        {createdDisplay !== 'N/A' && ` • Created ${createdDisplay}`}
      </div>
    </div>
  );
};

export default ProfilePage;
