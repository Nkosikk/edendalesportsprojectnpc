import apiClient, { handleApiResponse } from '../lib/api';
import type {
  DashboardData,
  User,
  BookingDetails,
  BlockSlotRequest,
  UpdateUserRoleRequest,
  UpdateUserStatusRequest,
  UpdateBookingStatusRequest,
  AdminBookingFilters,
  UserFilters,
  ApiResponse,
} from '../types';

/**
 * Admin Service
 * Handles all administrative functions
 */

export const adminService = {
  /**
   * Get dashboard data with statistics
   */
  getDashboard: async (fromDate?: string, toDate?: string): Promise<DashboardData> => {
    const response = await apiClient.get<ApiResponse<DashboardData>>('/admin/dashboard', {
      params: {
        from_date: fromDate,
        to_date: toDate,
      },
    });
    return handleApiResponse<DashboardData>(response);
  },

  /**
   * Get all users
   */
  getUsers: async (filters?: UserFilters): Promise<User[]> => {
    const response = await apiClient.get<ApiResponse<User[]>>('/admin/users', {
      params: filters,
    });
    const payload = handleApiResponse<any>(response);
    const list = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.data)
        ? payload.data
        : (Array.isArray(payload?.users) ? payload.users : []));

    const normalizeUser = (u: any): User => {
      const role = u.role ?? u.role_name ?? 'customer';
      const isActiveRaw = u.is_active;
      const emailVerifiedRaw = u.email_verified;
      return {
        id: Number(u.id),
        first_name: String(u.first_name ?? ''),
        last_name: String(u.last_name ?? ''),
        email: String(u.email ?? ''),
        phone: u.phone ? String(u.phone) : undefined,
        role: role,
        is_active: isActiveRaw === true || isActiveRaw === 1 || isActiveRaw === '1',
        email_verified: emailVerifiedRaw === true || emailVerifiedRaw === 1 || emailVerifiedRaw === '1',
        last_login: u.last_login ?? undefined,
        created_at: u.created_at ?? new Date().toISOString(),
        updated_at: u.updated_at ?? u.created_at ?? new Date().toISOString(),
      } as User;
    };

    return (list as any[]).map(normalizeUser);
  },

  /**
   * Get user by ID
   */
  getUserById: async (id: number): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>(`/admin/users/${id}`);
    return handleApiResponse<User>(response);
  },

  /**
   * Update user role (Admin only)
   */
  updateUserRole: async (id: number, data: UpdateUserRoleRequest): Promise<User> => {
    const response = await apiClient.put<ApiResponse<User>>(`/admin/users/${id}/role`, data);
    return handleApiResponse<User>(response);
  },

  /**
   * Update user status (activate/deactivate)
   */
  updateUserStatus: async (id: number, data: UpdateUserStatusRequest): Promise<void> => {
    const response = await apiClient.put<ApiResponse>(`/admin/users/${id}/status`, data);
    return handleApiResponse<void>(response);
  },

  /**
   * Get all bookings (admin view with filters)
   */
  getAllBookings: async (filters?: AdminBookingFilters): Promise<BookingDetails[]> => {
    const response = await apiClient.get<ApiResponse<BookingDetails[]>>('/admin/bookings', {
      params: filters,
    });
    const payload = handleApiResponse<any>(response);
    if (Array.isArray(payload)) return payload as BookingDetails[];
    if (Array.isArray(payload?.data)) return payload.data as BookingDetails[];
    if (Array.isArray(payload?.bookings)) return payload.bookings as BookingDetails[];
    return [];
  },

  /**
   * Block a time slot for maintenance/events
   */
  blockSlot: async (data: BlockSlotRequest): Promise<void> => {
    const response = await apiClient.post<ApiResponse>('/admin/block-slot', data);
    const result = handleApiResponse<void>(response);
    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({ action: 'block_slot', entity: 'field', entityId: data.field_id, metadata: data });
    })();
    return result;
  },

  /**
   * Unblock a previously blocked time slot
   */
  unblockSlot: async (data: BlockSlotRequest): Promise<void> => {
    const response = await apiClient.post<ApiResponse>('/admin/unblock-slot', data);
    const result = handleApiResponse<void>(response);
    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({ action: 'unblock_slot', entity: 'field', entityId: data.field_id, metadata: data });
    })();
    return result;
  },

  /**
   * Update booking status (confirm, cancel, complete)
   */
  updateBookingStatus: async (data: UpdateBookingStatusRequest): Promise<BookingDetails> => {
    const response = await apiClient.put<ApiResponse<BookingDetails>>(
      '/admin/booking-status',
      data
    );
    const result = handleApiResponse<BookingDetails>(response);
    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({ action: 'update_booking_status', entity: 'booking', entityId: data.booking_id, metadata: { status: data.status } });
    })();
    return result;
  },
};

export default adminService;
