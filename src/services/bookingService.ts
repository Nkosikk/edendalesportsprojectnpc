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
    return handleApiResponse<BookingDetails[]>(response);
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