import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import type { User, UserFilters, UpdateUserRoleRequest } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const UsersManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<UserFilters>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminService.getUsers(filters);
      setUsers(data);
    } catch (error: any) {
      console.error('Failed to fetch users', error);
      toast.error(error?.response?.data?.message || 'Unable to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<UpdateUserRoleRequest['role']>('customer');
  const [reason, setReason] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

  const openRoleModal = (user: User, role: UpdateUserRoleRequest['role']) => {
    setTargetUser(user);
    setTargetRole(role);
    setReason('');
    setRoleModalOpen(true);
  };

  const submitRoleChange = async () => {
    if (!targetUser) return;
    try {
      setUpdatingRole(true);
      await adminService.updateUserRole(targetUser.id, { role: targetRole, reason: reason || undefined });
      toast.success(`Role updated to ${targetRole}`);
      setRoleModalOpen(false);
      load();
    } catch {
      toast.error('Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const changeStatus = async (id: number, is_active: boolean) => {
    try {
      await adminService.updateUserStatus(id, { is_active });
      toast.success('Status updated');
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
      </div>

      <Card className="mb-4">
        <CardContent>
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={filters.role || ''}
                onChange={(e) => setFilters({ ...filters, role: (e.target.value as any) || undefined })}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="">All</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
                placeholder="Name or email"
                className="px-3 py-2 border rounded-lg"
              />
            </div>
            <Button onClick={load}>Refresh</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <Table
          data={users}
          keyExtractor={(u) => u.id.toString()}
          columns={[
            { key: 'id', title: 'ID' },
            { key: 'email', title: 'Email' },
            { key: 'first_name', title: 'First Name' },
            { key: 'last_name', title: 'Last Name' },
            {
              key: 'role',
              title: 'Role',
              render: (v) => <Badge variant={getStatusBadgeVariant(v)}>{String(v).toUpperCase()}</Badge>,
            },
            {
              key: 'is_active',
              title: 'Active',
              render: (v: boolean, row: User) => (
                <Button size="sm" variant={v ? 'secondary' : 'primary'} onClick={() => changeStatus(row.id, !v)}>
                  {v ? 'Deactivate' : 'Activate'}
                </Button>
              ),
            },
            {
              key: 'actions',
              title: 'Actions',
              render: (_: any, row: User) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openRoleModal(row, 'admin')}>Promote Admin</Button>
                  <Button size="sm" variant="outline" onClick={() => openRoleModal(row, 'staff')}>Set Staff</Button>
                  <Button size="sm" variant="outline" onClick={() => openRoleModal(row, 'customer')}>Set Customer</Button>
                </div>
              )
            },
          ]}
        />
      )}
      <Modal
        isOpen={roleModalOpen}
        onClose={() => !updatingRole && setRoleModalOpen(false)}
        title="Change User Role"
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleModalOpen(false)} disabled={updatingRole}>Cancel</Button>
            <Button onClick={submitRoleChange} loading={updatingRole}>Apply</Button>
          </>
        }
      >
        {!targetUser ? (
          <div className="text-sm text-gray-600">No user selected.</div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm">
              <p><span className="font-medium">User:</span> {targetUser.first_name} {targetUser.last_name} ({targetUser.email})</p>
              <p><span className="font-medium">Current Role:</span> <span className="capitalize">{targetUser.role}</span></p>
              <p><span className="font-medium">New Role:</span> <span className="capitalize">{targetRole}</span></p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Provide context for audit trail (e.g., outstanding contributions, staff assignment)."
              />
            </div>
            {targetRole === 'admin' && (
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Admin role grants full access including financial reports and user management. Ensure compliance and least-privilege principles.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsersManagementPage;
