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
    return handleApiResponse<User[]>(response);
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
    return handleApiResponse<BookingDetails[]>(response);
  },

  /**
   * Block a time slot for maintenance/events
   */
  blockSlot: async (data: BlockSlotRequest): Promise<void> => {
    const response = await apiClient.post<ApiResponse>('/admin/block-slot', data);
    return handleApiResponse<void>(response);
  },

  /**
   * Unblock a previously blocked time slot
   */
  unblockSlot: async (data: BlockSlotRequest): Promise<void> => {
    const response = await apiClient.post<ApiResponse>('/admin/unblock-slot', data);
    return handleApiResponse<void>(response);
  },

  /**
   * Update booking status (confirm, cancel, complete)
   */
  updateBookingStatus: async (data: UpdateBookingStatusRequest): Promise<BookingDetails> => {
    const response = await apiClient.put<ApiResponse<BookingDetails>>(
      '/admin/booking-status',
      data
    );
    return handleApiResponse<BookingDetails>(response);
  },
};

export default adminService;
