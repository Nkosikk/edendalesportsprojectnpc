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
    return handleApiResponse<BookingDetails>(response);
  },

  /**
   * Update an existing booking
   */
  updateBooking: async (id: number, data: UpdateBookingRequest): Promise<BookingDetails> => {
    const response = await apiClient.put<ApiResponse<BookingDetails>>(`/bookings/${id}`, data);
    return handleApiResponse<BookingDetails>(response);
  },

  /**
   * Cancel a booking
   */
  cancelBooking: async (id: number, reason?: string): Promise<void> => {
    const response = await apiClient.delete<ApiResponse>(`/bookings/${id}`, {
      data: { reason },
    });
    return handleApiResponse<void>(response);
  },
};