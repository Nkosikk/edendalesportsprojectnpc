import apiClient, { handleApiResponse } from '../lib/api';
import type {
  BookingDetails,
  CreateBookingRequest,
  UpdateBookingRequest,
  BookingFilters,
  ApiResponse,
} from '../types';
import { toApiTime } from '../utils/scheduling';

const normalizePaymentStatus = (row: any): BookingDetails['payment_status'] => {
  const raw = (row?.payment_status ?? row?.paymentStatus ?? row?.payment?.status ?? row?.payment_status_text ?? row?.status_payment ?? '').toString().toLowerCase();
  const isPaidFlag = row?.is_paid === true || row?.is_paid === 1 || row?.is_paid === '1' || !!row?.paid_at || !!row?.payment_confirmed_at;
  if (isPaidFlag) return 'paid';
  if (raw.includes('paid') || raw.includes('success') || raw.includes('completed') || raw === '1') return 'paid';
  if (raw.includes('manual')) return 'manual_pending';
  if (raw.includes('refund')) return 'refunded';
  if (raw.includes('fail')) return 'failed';
  if (raw.includes('pending')) return 'pending';
  return 'pending';
};

const normalizeBookingStatus = (row: any): BookingDetails['status'] => {
  const raw = (row?.status ?? row?.booking_status ?? row?.bookingStatus ?? row?.status_text ?? '').toString().toLowerCase();
  if (raw.startsWith('cancel')) return 'cancelled';
  if (raw.startsWith('confirm')) return 'confirmed';
  if (raw.startsWith('complete') || raw === 'done' || raw === 'finalized' || raw === 'finished') return 'completed';
  if (raw) return (['pending', 'confirmed', 'cancelled', 'completed'].includes(raw) ? raw : 'pending') as BookingDetails['status'];
  return 'pending';
};

const pickNumber = (...values: any[]): number | undefined => {
  for (const value of values) {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return undefined;
};

const pickString = (...values: any[]): string | undefined => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return undefined;
};

const normalizeBookingRecord = (row: any): BookingDetails => {
  const normalized: any = { ...row };
  normalized.payment_status = normalizePaymentStatus(row);
  normalized.status = normalizeBookingStatus(row);
  const id = pickNumber(row.id, row.booking_id, row.bookingId) ?? 0;
  normalized.id = Number(id);
  const bookingRef = pickString(row.booking_reference, row.reference, row.booking_ref, row.ref) ?? '';
  normalized.booking_reference = bookingRef;
  const totalAmount = pickNumber(row.total_amount, row.amount, row.total, row.price) ?? 0;
  normalized.total_amount = Number(totalAmount);
  const createdAt = pickString(row.created_at, row.booking_created_at, row.createdAt, row.created) ?? new Date().toISOString();
  normalized.created_at = createdAt;
  const updatedAt = pickString(row.updated_at, row.booking_updated_at, row.updatedAt, row.updated, createdAt);
  normalized.updated_at = updatedAt;
  const refundAmount = pickNumber(
    row.refund_amount,
    row.refundAmount,
    row.refund,
    row.amount_refund,
    row.amountRefund,
    row.refund_due,
    row.refundDue,
    row.amount_due_customer,
    row.amount_due_to_customer,
  );
  if (refundAmount !== undefined) normalized.refund_amount = refundAmount;
  const cancelReason = pickString(
    row.cancellation_reason,
    row.cancel_reason,
    row.cancelReason,
    row.status_reason,
    row.reason,
  );
  if (cancelReason) normalized.cancellation_reason = cancelReason;
  const cancelledAt = pickString(row.cancelled_at, row.canceled_at, row.cancelledAt, row.canceledAt);
  if (cancelledAt) normalized.cancelled_at = cancelledAt;
  return normalized as BookingDetails;
};

type BookingPayloadSource = Partial<CreateBookingRequest & UpdateBookingRequest> & { field_id?: number };

const parseTimeToHourFraction = (time?: string | null): number | null => {
  if (!time) return null;
  const match = String(time).match(/(\d{1,2}):(\d{1,2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour + minute / 60;
};

const deriveDurationHours = (data: BookingPayloadSource, normalizedStart?: string, normalizedEnd?: string): number | undefined => {
  const direct = data.duration_hours ?? (data as any).durationHours;
  if (typeof direct === 'number' && direct > 0) return direct;
  const start = parseTimeToHourFraction(normalizedStart ?? data.start_time ?? (data as any).startTime);
  const end = parseTimeToHourFraction(normalizedEnd ?? data.end_time ?? (data as any).endTime);
  if (start === null || end === null || end <= start) return undefined;
  const diff = end - start;
  return Number(diff.toFixed(2));
};

const buildBookingPayload = (data: BookingPayloadSource, { includeFieldId }: { includeFieldId: boolean }) => {
  const payload: Record<string, any> = {};

  if (includeFieldId) {
    const fieldId = Number(data.field_id);
    if (!Number.isFinite(fieldId)) {
      throw new Error('Field ID is required for booking creation');
    }
    payload.field_id = fieldId;
    payload.fieldId = fieldId;
    payload.field = fieldId;
  }

  if (data.booking_date) {
    payload.booking_date = data.booking_date;
    payload.bookingDate = data.booking_date;
  }

  const rawStart = data.start_time ?? (data as any).startTime;
  const rawEnd = data.end_time ?? (data as any).endTime;
  const normalizedStart = rawStart ? toApiTime(rawStart) : undefined;
  const normalizedEnd = rawEnd ? toApiTime(rawEnd) : undefined;

  if (normalizedStart) {
    payload.start_time = normalizedStart;
    payload.startTime = normalizedStart;
  }
  if (normalizedEnd) {
    payload.end_time = normalizedEnd;
    payload.endTime = normalizedEnd;
  }

  if (includeFieldId) {
    if (!payload.booking_date) throw new Error('Booking date is required for booking creation');
    if (!normalizedStart || !normalizedEnd) throw new Error('Start and end times are required for booking creation');
  }

  const duration = deriveDurationHours(data, normalizedStart, normalizedEnd);
  if (typeof duration === 'number' && duration > 0) {
    payload.duration_hours = duration;
    payload.durationHours = duration;
  }

  if (data.notes !== undefined) {
    payload.notes = data.notes;
  }

  return payload;
};

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

    const list: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.records)
      ? payload.records
      : [];
    return list.map(normalizeBookingRecord) as BookingDetails[];
  },

  /**
   * Get a specific booking by ID
   */
  getBookingById: async (id: number): Promise<BookingDetails> => {
    const response = await apiClient.get<ApiResponse<BookingDetails>>(`/bookings/${id}`);
    const payload = handleApiResponse<BookingDetails | any>(response);
    return normalizeBookingRecord(payload);
  },

  /**
   * Create a new booking
   */
  createBooking: async (data: CreateBookingRequest): Promise<BookingDetails> => {
    const payload = buildBookingPayload(data, { includeFieldId: true });
    const response = await apiClient.post<ApiResponse<BookingDetails>>('/bookings', payload);
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
    const payload = buildBookingPayload(data, { includeFieldId: false });
    const response = await apiClient.put<ApiResponse<BookingDetails>>(`/bookings/${id}`, payload);
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

  /**
   * Mark a booking as complete (Admin only)
   */
  markBookingComplete: async (id: number): Promise<BookingDetails> => {
    const response = await apiClient.put<ApiResponse<BookingDetails>>(`/bookings/${id}/complete`, {});
    const result = handleApiResponse<BookingDetails>(response);
    (async () => {
      const { logAudit } = await import('../lib/audit');
      logAudit({ action: 'complete_booking', entity: 'booking', entityId: id, metadata: { status: 'completed' } });
    })();
    return result;
  },
};