import apiClient, { handleApiResponse } from '../lib/api';
import { paymentService } from './paymentService';
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
    const params: Record<string, string> = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    const response = await apiClient.get<ApiResponse<any>>('/admin/dashboard', {
      params,
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
   * Get a single booking by ID (fresh from backend)
   */
  getBookingById: async (bookingId: number): Promise<BookingDetails> => {
    console.log('AdminService: Fetching single booking ID:', bookingId);
    const response = await apiClient.get<ApiResponse<BookingDetails>>(`/admin/bookings/${bookingId}`);
    console.log('AdminService: Single booking raw response:', response.data);
    
    const payload = handleApiResponse<any>(response);
    console.log('AdminService: Single booking processed payload:', payload);
    
    const normalizePaymentStatus = (row: any): BookingDetails['payment_status'] => {
      // First check boolean/timestamp flags - these are most reliable
      const isPaidFlag = row?.is_paid === true || row?.is_paid === 1 || row?.is_paid === '1' || !!row?.paid_at || !!row?.payment_confirmed_at;
      if (isPaidFlag) return 'paid';
      
      // Check all possible field names for payment status
      const paymentFields = [
        row?.payment_status,
        row?.paymentStatus,
        row?.payment?.status,
        row?.payment_status_text,
        row?.status_payment,
        row?.payment_state,
        row?.paymentState,
        row?.payment?.state,
      ];
      
      for (const field of paymentFields) {
        const raw = (field ?? '').toString().toLowerCase().trim();
        if (!raw) continue;
        
        // Exact matches first
        if (raw === 'paid' || raw === 'success' || raw === 'completed' || raw === '1') return 'paid';
        if (raw === 'manual_pending' || raw === 'manual pending') return 'manual_pending';
        if (raw === 'refunded' || raw === 'refund') return 'refunded';
        if (raw === 'failed' || raw === 'fail') return 'failed';
        if (raw === 'pending') return 'pending';
        
        // Substring matches for robustness
        if (raw.includes('paid') || raw.includes('success')) return 'paid';
        if (raw.includes('manual')) return 'manual_pending';
        if (raw.includes('refund')) return 'refunded';
        if (raw.includes('fail')) return 'failed';
      }
      
      return 'pending';
    };

    const normalizeBookingStatus = (row: any): BookingDetails['status'] => {
      const raw = (row?.status ?? row?.booking_status ?? row?.bookingStatus ?? row?.status_text ?? '').toString().toLowerCase();
      if (raw.startsWith('cancel')) return 'cancelled';
      if (raw.startsWith('confirm')) return 'confirmed';
      if (raw.startsWith('complete') || raw === 'done' || raw === 'finalized' || raw === 'finished') return 'completed';
      if (raw) return (['pending','confirmed','cancelled','completed'].includes(raw) ? raw : 'pending') as BookingDetails['status'];
      return 'pending';
    };

    const booking = payload as any;
    console.log('AdminService: Normalizing single booking');
    const normalized: any = { ...booking };
    normalized.id = Number(booking.id ?? booking.booking_id ?? booking.bookingId);
    normalized.booking_reference = String(booking.booking_reference ?? booking.reference ?? booking.booking_ref ?? booking.ref ?? '');
    const paymentIdCandidates = [
      booking.payment_id,
      booking.paymentId,
      booking.payment?.id,
      booking.payment?.payment_id,
      booking.payment?.paymentId,
      booking.payment_details?.id,
      booking.payment_details?.payment_id,
    ];
    for (const candidate of paymentIdCandidates) {
      const num = Number(candidate);
      if (Number.isFinite(num)) {
        normalized.payment_id = num;
        break;
      }
    }
    const amt = Number(booking.total_amount ?? booking.amount ?? booking.total ?? booking.price);
    if (Number.isFinite(amt)) normalized.total_amount = amt;
    normalized.payment_status = normalizePaymentStatus(booking);
    normalized.status = normalizeBookingStatus(booking);
    normalized.created_at = String(booking.created_at ?? booking.booking_created_at ?? booking.createdAt ?? booking.created ?? new Date().toISOString());
    normalized.updated_at = String(booking.updated_at ?? booking.booking_updated_at ?? booking.updatedAt ?? booking.updated ?? normalized.created_at);
    const refundAmount = Number(booking.refund_amount ?? booking.refundAmount ?? booking.refund ?? booking.amount_refund ?? booking.amountRefund ?? booking.refund_due ?? booking.refundDue ?? booking.amount_due_customer ?? booking.amount_due_to_customer);
    if (!Number.isNaN(refundAmount)) normalized.refund_amount = refundAmount;
    const cancelReason = booking.cancellation_reason ?? booking.cancel_reason ?? booking.cancelReason ?? booking.status_reason ?? booking.reason;
    if (cancelReason) normalized.cancellation_reason = String(cancelReason);
    const cancelledAt = booking.cancelled_at ?? booking.canceled_at ?? booking.cancelledAt ?? booking.canceledAt;
    if (cancelledAt) normalized.cancelled_at = String(cancelledAt);
    
    console.log('AdminService: Final normalized booking:', normalized);
    return normalized as BookingDetails;
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
    
    const normalizePaymentStatus = (row: any): BookingDetails['payment_status'] => {
      // First check boolean/timestamp flags - these are most reliable
      const isPaidFlag = row?.is_paid === true || row?.is_paid === 1 || row?.is_paid === '1' || !!row?.paid_at || !!row?.payment_confirmed_at;
      if (isPaidFlag) return 'paid';
      
      // Check all possible field names for payment status
      const paymentFields = [
        row?.payment_status,
        row?.paymentStatus,
        row?.payment?.status,
        row?.payment_status_text,
        row?.status_payment,
        row?.payment_state,
        row?.paymentState,
        row?.payment?.state,
      ];
      
      for (const field of paymentFields) {
        const raw = (field ?? '').toString().toLowerCase().trim();
        if (!raw) continue;
        
        // Exact matches first
        if (raw === 'paid' || raw === 'success' || raw === 'completed' || raw === '1') return 'paid';
        if (raw === 'manual_pending' || raw === 'manual pending') return 'manual_pending';
        if (raw === 'refunded' || raw === 'refund') return 'refunded';
        if (raw === 'failed' || raw === 'fail') return 'failed';
        if (raw === 'pending') return 'pending';
        
        // Substring matches for robustness
        if (raw.includes('paid') || raw.includes('success')) return 'paid';
        if (raw.includes('manual')) return 'manual_pending';
        if (raw.includes('refund')) return 'refunded';
        if (raw.includes('fail')) return 'failed';
      }
      
      return 'pending';
    };

    const normalizeBookingStatus = (row: any): BookingDetails['status'] => {
      const raw = (row?.status ?? row?.booking_status ?? row?.bookingStatus ?? row?.status_text ?? '').toString().toLowerCase();
      if (raw.startsWith('cancel')) return 'cancelled';
      if (raw.startsWith('confirm')) return 'confirmed';
      if (raw.startsWith('complete') || raw === 'done' || raw === 'finalized' || raw === 'finished') return 'completed';
      if (raw) return (['pending','confirmed','cancelled','completed'].includes(raw) ? raw : 'pending') as BookingDetails['status'];
      return 'pending';
    };

    const shapeToArray = (src: any): any[] | null => {
      if (Array.isArray(src)) return src;
      if (Array.isArray(src?.data)) return src.data;
      if (Array.isArray(src?.bookings)) return src.bookings;
      if (Array.isArray(src?.items)) return src.items;
      if (Array.isArray(src?.results)) return src.results;
      if (Array.isArray(src?.records)) return src.records;
      return null;
    };

    const list = shapeToArray(payload);
    if (list) {
      console.log('AdminService: Normalizing bookings array, length:', list.length);
      return (list as any[]).map((b) => {
        try {
          const normalized: any = { ...b };
          // Normalize identifiers
          normalized.id = Number(b.id ?? b.booking_id ?? b.bookingId);
          normalized.booking_reference = String(b.booking_reference ?? b.reference ?? b.booking_ref ?? b.ref ?? '');
          const paymentIdCandidates = [
            b.payment_id,
            b.paymentId,
            b.payment?.id,
            b.payment?.payment_id,
            b.payment?.paymentId,
            b.payment_details?.id,
            b.payment_details?.payment_id,
          ];
          for (const candidate of paymentIdCandidates) {
            const num = Number(candidate);
            if (Number.isFinite(num)) {
              normalized.payment_id = num;
              break;
            }
          }
          // Normalize money/time fields defensively
          const amt = Number(b.total_amount ?? b.amount ?? b.total ?? b.price);
          if (Number.isFinite(amt)) normalized.total_amount = amt; 
          // Normalize statuses
          normalized.payment_status = normalizePaymentStatus(b);
          normalized.status = normalizeBookingStatus(b);
          // Normalize timestamps for consistent sorting
          normalized.created_at = String(b.created_at ?? b.booking_created_at ?? b.createdAt ?? b.created ?? new Date().toISOString());
          normalized.updated_at = String(b.updated_at ?? b.booking_updated_at ?? b.updatedAt ?? b.updated ?? normalized.created_at);
          const refundAmount = Number(b.refund_amount ?? b.refundAmount ?? b.refund ?? b.amount_refund ?? b.amountRefund ?? b.refund_due ?? b.refundDue ?? b.amount_due_customer ?? b.amount_due_to_customer);
          if (!Number.isNaN(refundAmount)) normalized.refund_amount = refundAmount;
          const cancelReason = b.cancellation_reason ?? b.cancel_reason ?? b.cancelReason ?? b.status_reason ?? b.reason;
          if (cancelReason) normalized.cancellation_reason = String(cancelReason);
          const cancelledAt = b.cancelled_at ?? b.canceled_at ?? b.cancelledAt ?? b.canceledAt;
          if (cancelledAt) normalized.cancelled_at = String(cancelledAt);
          return normalized as BookingDetails;
        } catch {
          return b as BookingDetails;
        }
      });
    }
    
    console.warn('AdminService: No recognizable array found in response, returning empty array');
    console.warn('AdminService: Payload keys:', Object.keys(payload || {}));
    return [];
  },

  /**
   * Block a time slot for maintenance/events
   */
  blockSlot: async (data: BlockSlotRequest): Promise<void> => {
    const response = await apiClient.post<ApiResponse>('/admin/block-slot', data, {
      headers: { 'X-Suppress-Error-Toast': '1' },
    });
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
    const response = await apiClient.post<ApiResponse>('/admin/unblock-slot', data, {
      headers: { 'X-Suppress-Error-Toast': '1' },
    });
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

  /**
   * Mark a booking refund as processed (set payment_status to refunded)
   */
  markBookingRefunded: async (
    data: { booking_id: number; payment_id?: number; amount?: number; reason?: string }
  ): Promise<BookingDetails | null> => {
    const bookingId = Number(data.booking_id);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      throw new Error('A valid booking ID is required to mark a refund.');
    }

    let paymentIdNumber = Number(data.payment_id);
    if (!Number.isFinite(paymentIdNumber) || paymentIdNumber <= 0) {
      try {
        const paymentStatus = await paymentService.getPaymentStatus(undefined, bookingId);
        const statusPaymentId = Number(paymentStatus?.payment?.id ?? paymentStatus?.payment_id);
        if (Number.isFinite(statusPaymentId) && statusPaymentId > 0) {
          paymentIdNumber = statusPaymentId;
        }
      } catch (error) {
        console.warn('adminService.markBookingRefunded: Unable to fetch payment status for booking', bookingId, error);
      }
    }

    if (!Number.isFinite(paymentIdNumber) || paymentIdNumber <= 0) {
      throw new Error('Unable to determine the payment ID for this booking. Please verify the payment record before marking as refunded.');
    }

    const requestBody: Record<string, any> = {
      booking_id: bookingId,
      payment_id: paymentIdNumber,
    };
    if (typeof data.amount === 'number') {
      requestBody.amount = data.amount;
      requestBody.refund_amount = data.amount;
    }
    if (data.reason) {
      requestBody.reason = data.reason;
      requestBody.notes = data.reason;
    }

    const token = localStorage.getItem('accessToken');
    const response = await apiClient.put<ApiResponse<BookingDetails | any>>(
      `/payments/refunds/${paymentIdNumber}/complete`,
      requestBody,
      token
        ? {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        : undefined
    );

    const raw = response?.data as any;
    if (typeof raw?.success === 'boolean' && !raw.success) {
      throw new Error(raw?.message || 'Failed to mark booking as refunded');
    }

    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({
        action: 'mark_refund',
        entity: 'booking',
        entityId: bookingId,
        metadata: { amount: data.amount, reason: data.reason, payment_id: paymentIdNumber },
      });
    })();

    const bookingData = raw?.data ?? raw?.booking ?? null;
    return bookingData ? (bookingData as BookingDetails) : null;
  },
};

export default adminService;
