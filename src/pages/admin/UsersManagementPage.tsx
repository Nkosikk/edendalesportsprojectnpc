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
import { MoreVertical } from 'lucide-react';

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

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<UpdateUserRoleRequest['role']>('customer');
  const [reason, setReason] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  useEffect(() => { load(); }, [filters]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdown !== null) {
        setOpenDropdown(null);
      }
    };
    
    if (openDropdown !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdown]);

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
    console.log(`Changing user ${id} status to: ${is_active ? 'ACTIVE' : 'INACTIVE'}`);
    try {
      await adminService.updateUserStatus(id, { is_active });
      toast.success(`User ${is_active ? 'activated' : 'deactivated'} successfully`);
      load(); // Reload the user list
    } catch (error: any) {
      console.error('Failed to update user status:', error);
      toast.error(error?.response?.data?.message || 'Failed to update status');
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 max-w-screen-xl">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Users Management</h1>
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
            { key: 'id', title: 'ID', className: 'w-[6%]' },
            { key: 'email', title: 'Email', className: 'w-[25%] truncate' },
            { key: 'first_name', title: 'First Name', className: 'w-[15%] truncate' },
            { key: 'last_name', title: 'Last Name', className: 'w-[15%] truncate' },
            {
              key: 'role',
              title: 'Role',
              className: 'w-[10%]',
              render: (v) => <Badge variant={getStatusBadgeVariant(v)} className="text-xs px-1 py-0.5">{String(v).toUpperCase()}</Badge>,
            },
            {
              key: 'is_active',
              title: 'Active',
              className: 'w-[20%]',
              render: (v: boolean, row: User) => {
                const isActive = Boolean(v);
                
                return (
                  <Button 
                    size="sm" 
                    variant={isActive ? 'secondary' : 'primary'} 
                    onClick={() => changeStatus(row.id, !isActive)}
                    className="text-xs px-1.5 py-0.5"
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                );
              },
            },
            {
              key: 'actions',
              title: 'ACTIONS',
              className: 'w-[9%]',
              render: (_: any, row: User) => (
                <div className="relative inline-block text-left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Clicked dropdown for user:', row.id, 'Current open:', openDropdown);
                      setOpenDropdown(openDropdown === row.id ? null : row.id);
                    }}
                    className="inline-flex items-center justify-center w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    aria-expanded={openDropdown === row.id}
                    aria-haspopup="true"
                  >
                    <MoreVertical className="h-4 w-4 text-gray-400" />
                  </button>

                  {openDropdown === row.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-40"
                        onClick={() => setOpenDropdown(null)}
                      />
                      <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        <div className="py-1" role="menu">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRoleModal(row, 'admin');
                              setOpenDropdown(null);
                            }}
                            className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 w-full text-left"
                            role="menuitem"
                          >
                            Promote Admin
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRoleModal(row, 'staff');
                              setOpenDropdown(null);
                            }}
                            className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 w-full text-left"
                            role="menuitem"
                          >
                            Set Staff
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRoleModal(row, 'customer');
                              setOpenDropdown(null);
                            }}
                            className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900 w-full text-left"
                            role="menuitem"
                          >
                            Set Customer
                          </button>
                        </div>
                      </div>
                    </>
                  )}
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
