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
    const response = await apiClient.get<ApiResponse<any>>('/admin/dashboard', {
      params: {
        from_date: fromDate,
        to_date: toDate,
      },
    });
    const raw = handleApiResponse<any>(response);

    // Normalize different possible API shapes into DashboardData
    const pickNum = (...vals: any[]) => {
      const v = vals.find((x) => x !== undefined && x !== null);
      const n = typeof v === 'string' ? Number(v) : v;
      return Number.isFinite(n) ? (n as number) : 0;
    };

    const summarySrc = raw?.summary || raw?.overview || raw?.stats || raw || {};
    const summary = {
      total_bookings: pickNum(summarySrc.total_bookings, summarySrc.bookings_total, summarySrc.bookings_count),
      total_hours: pickNum(summarySrc.total_hours, summarySrc.hours_total, summarySrc.sum_hours),
      total_revenue: pickNum(summarySrc.total_revenue, summarySrc.revenue_total, summarySrc.sum_revenue),
      confirmed_bookings: pickNum(summarySrc.confirmed_bookings, summarySrc.bookings_confirmed, summarySrc.confirmed_count),
      cancelled_bookings: pickNum(summarySrc.cancelled_bookings, summarySrc.bookings_cancelled, summarySrc.cancelled_count),
      pending_payments: pickNum(summarySrc.pending_payments, summarySrc.payments_pending, summarySrc.pending_count),
      total_users: pickNum(summarySrc.total_users, summarySrc.users_total, summarySrc.users_count),
    } as DashboardData['summary'];

    // Daily revenue timeline
    const timeline = raw?.daily_revenue || raw?.revenue_timeline || [];
    const daily_revenue: DashboardData['daily_revenue'] = Array.isArray(timeline)
      ? timeline.map((d: any) => ({
          date: d.date || d.period || d.day || new Date().toISOString().slice(0, 10),
          revenue: pickNum(d.revenue, d.total_revenue, d.amount),
          bookings: pickNum(d.bookings, d.total_bookings, d.count),
        }))
      : [];

    // Recent bookings
    const recent = raw?.recent_bookings || raw?.bookings_recent || raw?.latest_bookings || [];
    const recent_bookings: DashboardData['recent_bookings'] = Array.isArray(recent) ? recent : [];

    const period = {
      from_date: raw?.period?.from_date || fromDate || new Date().toISOString().slice(0, 10),
      to_date: raw?.period?.to_date || toDate || new Date().toISOString().slice(0, 10),
    } as DashboardData['period'];

    return { period, summary, recent_bookings, field_utilization: raw?.field_utilization || [], daily_revenue } as DashboardData;
  },

  /**
   * Get all users
   */
  getUsers: async (filters?: UserFilters): Promise<User[]> => {
    // Always ask for a generous page size in case the API paginates
    const params = { ...(filters || {}), limit: 1000, page_size: 1000 } as Record<string, any>;
    const response = await apiClient.get<ApiResponse<User[]>>('/admin/users', { params });
    // Log and normalize various possible API shapes
    // Accept: [], {data: []}, {users: []}, {data: {users: []}}, {items: []}, {results: []}, {records: []}
    const payload = handleApiResponse<any>(response);

    const candidates: any[] = [];
    if (Array.isArray(payload)) candidates.push(payload);
    if (Array.isArray(payload?.data)) candidates.push(payload.data);
    if (Array.isArray(payload?.users)) candidates.push(payload.users);
    if (Array.isArray(payload?.items)) candidates.push(payload.items);
    if (Array.isArray(payload?.results)) candidates.push(payload.results);
    if (Array.isArray(payload?.records)) candidates.push(payload.records);
    if (Array.isArray(payload?.data?.users)) candidates.push(payload.data.users);
    if (Array.isArray(payload?.data?.items)) candidates.push(payload.data.items);
    if (Array.isArray(payload?.data?.results)) candidates.push(payload.data.results);
    if (Array.isArray(payload?.users?.data)) candidates.push(payload.users.data);

    const list = candidates.find((arr) => Array.isArray(arr)) || [];

    const normalizeUser = (u: any): User => {
      const role = u.role ?? u.role_name ?? 'customer';
      const isActiveRaw = u.is_active;
      const emailVerifiedRaw = u.email_verified;
      
      // Handle different possible values for is_active: 1, '1', true = active; 0, '0', false = inactive
      const isActive = isActiveRaw === 1 || isActiveRaw === '1' || isActiveRaw === true;
      const emailVerified = emailVerifiedRaw === 1 || emailVerifiedRaw === '1' || emailVerifiedRaw === true;
      
      return {
        id: Number(u.id),
        first_name: String(u.first_name ?? ''),
        last_name: String(u.last_name ?? ''),
        email: String(u.email ?? ''),
        phone: u.phone ? String(u.phone) : undefined,
        role: role,
        is_active: isActive,
        email_verified: emailVerified,
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
    console.log('AdminService: Making request to /admin/bookings with filters:', filters);
    const response = await apiClient.get<ApiResponse<BookingDetails[]>>('/admin/bookings', {
      params: filters,
    });
    console.log('AdminService: Raw response:', response.data);
    
    const payload = handleApiResponse<any>(response);
    console.log('AdminService: Processed payload:', payload);
    
    if (Array.isArray(payload)) {
      console.log('AdminService: Found array payload, length:', payload.length);
      return payload as BookingDetails[];
    }
    if (Array.isArray(payload?.data)) {
      console.log('AdminService: Found payload.data array, length:', payload.data.length);
      return payload.data as BookingDetails[];
    }
    if (Array.isArray(payload?.bookings)) {
      console.log('AdminService: Found payload.bookings array, length:', payload.bookings.length);
      return payload.bookings as BookingDetails[];
    }
    
    console.warn('AdminService: No recognizable array found in response, returning empty array');
    console.warn('AdminService: Payload keys:', Object.keys(payload || {}));
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
    // Normalize payload and include common alias keys some backends expect
    const payload: any = {
      booking_id: Number(data.booking_id),
      status: String(data.status),
    };
    // Add alias fields for compatibility
    payload.id = payload.booking_id;
    payload.bookingId = payload.booking_id;
    payload.booking_status = payload.status;
    payload.action = payload.status;
    if (data.reason !== undefined) payload.reason = data.reason;
    if (data.refund_amount !== undefined) payload.refund_amount = data.refund_amount;

    let response: any;
    try {
      response = await apiClient.put<ApiResponse<BookingDetails>>('/admin/booking-status', payload, {
        headers: { 'X-Suppress-Error-Toast': '1' },
      });
    } catch (err: any) {
      // Fallback to POST in case the endpoint expects it
      response = await apiClient.post<ApiResponse<BookingDetails>>('/admin/booking-status', payload, {
        headers: { 'X-Suppress-Error-Toast': '1' },
      });
    }
    const result = handleApiResponse<BookingDetails>(response);
    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({ action: 'update_booking_status', entity: 'booking', entityId: data.booking_id, metadata: { status: data.status } });
    })();
    return result;
  },

  /**
   * Mark a booking as paid manually
   */
  markBookingAsPaid: async (bookingId: string): Promise<void> => {
    console.log('AdminService: Marking booking as paid, ID:', bookingId);
    const response = await apiClient.post(`/admin/bookings/${bookingId}/mark-paid`);
    console.log('AdminService: Mark as paid response:', response.data);
  },
};

export default adminService;
