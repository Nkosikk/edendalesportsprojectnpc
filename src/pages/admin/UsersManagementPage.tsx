import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import type { User, UserFilters, UpdateUserRoleRequest } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const changeRole = async (id: number, role: UpdateUserRoleRequest['role']) => {
    try {
      await adminService.updateUserRole(id, { role });
      toast.success('Role updated');
      load();
    } catch {
      toast.error('Failed to update role');
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
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => changeRole(row.id, 'admin')}>Make Admin</Button>
                  <Button size="sm" variant="outline" onClick={() => changeRole(row.id, 'staff')}>Make Staff</Button>
                  <Button size="sm" variant="outline" onClick={() => changeRole(row.id, 'customer')}>Make Customer</Button>
                </div>
              )
            },
          ]}
        />
      )}
    </div>
  );
};

export default UsersManagementPage;
