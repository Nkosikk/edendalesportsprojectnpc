import apiClient, { handleApiResponse } from '../lib/api';
import type {
  BookingDetails,
  CreateBookingRequest,
  UpdateBookingRequest,
  BookingFilters,
  ApiResponse,
} from '../types';

/**
 * Booking Service
 * Handles all booking-related operations
 */

export const bookingService = {
  /**
   * Get bookings (user's own bookings for customers, all for admin/staff)
   */
  getBookings: async (filters?: BookingFilters): Promise<BookingDetails[]> => {
    const response = await apiClient.get<ApiResponse<BookingDetails[]>>('/bookings', {
      params: filters,
    });
    const payload = handleApiResponse<any>(response);
    const normalizePaymentStatus = (row: any): BookingDetails['payment_status'] => {
      const raw = (row?.payment_status ?? row?.paymentStatus ?? row?.payment?.status ?? row?.payment_status_text ?? row?.status_payment ?? '').toString().toLowerCase();
      const isPaidFlag = row?.is_paid === true || row?.is_paid === 1 || row?.is_paid === '1' || !!row?.paid_at || !!row?.payment_confirmed_at;
      if (isPaidFlag) return 'paid';
      if (raw.includes('paid') || raw.includes('success') || raw.includes('completed') || raw === '1') return 'paid';
      if (raw.includes('manual')) return 'manual_pending';
      if (raw.includes('refund')) return 'refunded';
      if (raw.includes('fail')) return 'failed';
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

    const list: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.records) ? payload.records : [];
    return list.map((b) => ({
      ...b,
      payment_status: normalizePaymentStatus(b),
      status: normalizeBookingStatus(b),
      id: Number(b.id ?? b.booking_id ?? b.bookingId),
      booking_reference: String(b.booking_reference ?? b.reference ?? b.booking_ref ?? b.ref ?? ''),
      total_amount: Number(b.total_amount ?? b.amount ?? b.total ?? b.price ?? 0),
      created_at: String(b.created_at ?? b.booking_created_at ?? b.createdAt ?? b.created ?? new Date().toISOString()),
      updated_at: String(b.updated_at ?? b.booking_updated_at ?? b.updatedAt ?? b.updated ?? (b.created_at ?? new Date().toISOString())),
    })) as BookingDetails[];
  },

  /**
   * Get a specific booking by ID
   */
  getBookingById: async (id: number): Promise<BookingDetails> => {
    const response = await apiClient.get<ApiResponse<BookingDetails>>(`/bookings/${id}`);
    return handleApiResponse<BookingDetails>(response);
  },

  /**
   * Create a new booking
   */
  createBooking: async (data: CreateBookingRequest): Promise<BookingDetails> => {
    const response = await apiClient.post<ApiResponse<BookingDetails>>('/bookings', data);
    const result = handleApiResponse<BookingDetails>(response);
    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({ action: 'create_booking', entity: 'booking', entityId: result.id, metadata: { field_id: result.field_id, start_time: result.start_time, end_time: result.end_time } });
    })();
    return result;
  },

  /**
   * Update an existing booking
   */
  updateBooking: async (id: number, data: UpdateBookingRequest): Promise<BookingDetails> => {
    const response = await apiClient.put<ApiResponse<BookingDetails>>(`/bookings/${id}`, data);
    const result = handleApiResponse<BookingDetails>(response);
    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({ action: 'update_booking', entity: 'booking', entityId: id, metadata: { changes: data } });
    })();
    return result;
  },

  /**
   * Cancel a booking
   */
  cancelBooking: async (id: number, reason?: string): Promise<void> => {
    const response = await apiClient.delete<ApiResponse>(`/bookings/${id}`, {
      data: { reason },
    });
    const result = handleApiResponse<void>(response);
    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({ action: 'cancel_booking', entity: 'booking', entityId: id, metadata: { reason } });
    })();
    return result;
  },
};