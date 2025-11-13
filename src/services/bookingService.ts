import { apiClient, handleApiResponse } from '../lib/api';
import { 
  Booking, 
  CreateBookingRequest, 
  UpdateBookingRequest,
  BookingFilters,
  ApiResponse, 
  PaginatedResponse 
} from '../types';

export const bookingService = {
  // Get user's bookings
  getMyBookings: async (filters?: BookingFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await apiClient.get<ApiResponse<PaginatedResponse<Booking>>>(
      `/bookings/my?${params.toString()}`
    );
    return handleApiResponse<PaginatedResponse<Booking>>(response);
  },

  // Get all bookings (admin only)
  getAllBookings: async (filters?: BookingFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.fieldId) params.append('fieldId', filters.fieldId);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await apiClient.get<ApiResponse<PaginatedResponse<Booking>>>(
      `/admin/bookings?${params.toString()}`
    );
    return handleApiResponse<PaginatedResponse<Booking>>(response);
  },

  // Get booking by ID
  getBooking: async (id: string) => {
    const response = await apiClient.get<ApiResponse<Booking>>(`/bookings/${id}`);
    return handleApiResponse<Booking>(response);
  },

  // Create new booking
  createBooking: async (bookingData: CreateBookingRequest) => {
    const response = await apiClient.post<ApiResponse<Booking>>('/bookings', bookingData);
    return handleApiResponse<Booking>(response);
  },

  // Update booking
  updateBooking: async (id: string, bookingData: UpdateBookingRequest) => {
    const response = await apiClient.put<ApiResponse<Booking>>(`/bookings/${id}`, bookingData);
    return handleApiResponse<Booking>(response);
  },

  // Cancel booking
  cancelBooking: async (id: string) => {
    const response = await apiClient.patch<ApiResponse<Booking>>(`/bookings/${id}/cancel`);
    return handleApiResponse<Booking>(response);
  },

  // Confirm booking (admin only)
  confirmBooking: async (id: string) => {
    const response = await apiClient.patch<ApiResponse<Booking>>(`/admin/bookings/${id}/confirm`);
    return handleApiResponse<Booking>(response);
  },

  // Complete booking
  completeBooking: async (id: string) => {
    const response = await apiClient.patch<ApiResponse<Booking>>(`/bookings/${id}/complete`);
    return handleApiResponse<Booking>(response);
  },

  // Delete booking (admin only)
  deleteBooking: async (id: string) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/admin/bookings/${id}`);
    return handleApiResponse<void>(response);
  },
};