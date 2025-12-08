import apiClient, { handleApiResponse } from '../lib/api';
import type {
  BookingDetails,
  CreateBookingRequest,
  UpdateBookingRequest,
  BookingFilters,
  ApiResponse,
} from '../types';
import { toApiTime, isPublicHoliday, isWeekend, WEEKEND_START_HOUR, WEEKEND_END_HOUR } from '../utils/scheduling';

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

const isBookingTimePassed = (row: any): boolean => {
  const bookingDate = pickString(row.booking_date, row.bookingDate, row.date);
  const endTime = pickString(row.end_time, row.endTime, row.end);
  if (!bookingDate || !endTime) return false;
  
  try {
    // Parse booking date
    const dateParts = bookingDate.split('-');
    if (dateParts.length !== 3) return false;
    
    // Parse end time (handles "HH:mm" or "HH:mm:ss")
    const timeMatch = endTime.match(/(\d{1,2}):(\d{1,2})/);
    if (!timeMatch) return false;
    
    const bookingEndDateTime = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      parseInt(timeMatch[1]),
      parseInt(timeMatch[2])
    );
    
    return new Date() > bookingEndDateTime;
  } catch {
    return false;
  }
};

const normalizeBookingRecord = (row: any): BookingDetails => {
  const normalized: any = { ...row };
  normalized.payment_status = normalizePaymentStatus(row);
  let status = normalizeBookingStatus(row);
  
  // Auto-mark as completed if booking is confirmed, paid, and time has passed
  if (
    status === 'confirmed' &&
    normalized.payment_status === 'paid' &&
    isBookingTimePassed(row)
  ) {
    status = 'completed';
  }
  
  normalized.status = status;
  const id = pickNumber(row.id, row.booking_id, row.bookingId) ?? 0;
  normalized.id = Number(id);
  const paymentId = pickNumber(
    row.payment_id,
    row.paymentId,
    row.payment?.id,
    row.payment?.payment_id,
    row.payment?.paymentId,
    row.payment_details?.id,
    row.payment_details?.payment_id,
  );
  if (paymentId !== undefined) normalized.payment_id = Number(paymentId);
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

  const fieldIdCandidate = data.field_id ?? (data as any).fieldId ?? (data as any).field;
  if (includeFieldId || fieldIdCandidate !== undefined) {
    const fieldId = Number(fieldIdCandidate);
    if (includeFieldId && !Number.isFinite(fieldId)) {
      throw new Error('Field ID is required for booking creation');
    }
    if (Number.isFinite(fieldId)) {
      payload.field_id = fieldId;
      payload.fieldId = fieldId;
      payload.field = fieldId;
    }
  }

  const bookingIdCandidate = data.id ?? data.booking_id ?? (data as any).bookingId;
  if (bookingIdCandidate !== undefined) {
    const bookingId = Number(bookingIdCandidate);
    if (Number.isFinite(bookingId)) {
      payload.booking_id = bookingId;
      payload.bookingId = bookingId;
      payload.id = bookingId;
    }
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

  const originalDate = data.original_booking_date ?? (data as any).originalBookingDate;
  if (originalDate) {
    payload.original_booking_date = originalDate;
    payload.originalBookingDate = originalDate;
  }

  const originalStartRaw = data.original_start_time ?? (data as any).originalStartTime;
  const originalEndRaw = data.original_end_time ?? (data as any).originalEndTime;
  const normalizedOriginalStart = originalStartRaw ? toApiTime(originalStartRaw) : undefined;
  const normalizedOriginalEnd = originalEndRaw ? toApiTime(originalEndRaw) : undefined;

  if (normalizedOriginalStart) {
    payload.original_start_time = normalizedOriginalStart;
    payload.originalStartTime = normalizedOriginalStart;
  }
  if (normalizedOriginalEnd) {
    payload.original_end_time = normalizedOriginalEnd;
    payload.originalEndTime = normalizedOriginalEnd;
  }

  if (includeFieldId) {
    if (!payload.booking_date) throw new Error('Booking date is required for booking creation');
    if (!normalizedStart || !normalizedEnd) throw new Error('Start and end times are required for booking creation');

    // Hint backend to always create a fresh record instead of mutating a cancelled booking
    const clientReference = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    payload.force_new = true;
    payload.create_new_record = true;
    payload.preserve_cancelled = true;
    payload.allow_duplicate = true;
    payload.source = 'web-app';
    payload.client_reference = clientReference;
  }

  const bookingDateValue = payload.booking_date ?? data.booking_date;
  const dateObj = bookingDateValue ? new Date(`${bookingDateValue}T00:00:00`) : null;
  const weekendFlag = dateObj ? isWeekend(dateObj) : false;
  const holidayFlag = dateObj ? isPublicHoliday(dateObj) : false;
  const weekendOrHolidayFlag = weekendFlag || holidayFlag;
  const isWeekendOrHoliday = weekendOrHolidayFlag;
  const weekendStart = `${String(WEEKEND_START_HOUR).padStart(2, '0')}:00:00`;
  const weekendEnd = `${String(WEEKEND_END_HOUR).padStart(2, '0')}:00:00`;

  if (isWeekendOrHoliday) {
    const overrides: Record<string, any> = {
      operating_hours: { start_time: weekendStart, end_time: weekendEnd },
      operatingHours: { start_time: weekendStart, end_time: weekendEnd },
      operating_hours_start: weekendStart,
      operating_hours_end: weekendEnd,
      operating_start_time: weekendStart,
      operating_end_time: weekendEnd,
      operating_start: weekendStart,
      operating_end: weekendEnd,
      override_operating_hours_start: weekendStart,
      override_operating_hours_end: weekendEnd,
      override_start_time: weekendStart,
      override_end_time: weekendEnd,
      allow_morning_hours: 1,
      morning_override: 1,
      early_hours_override: 1,
      force_operating_hours: 1,
      forceOperatingHours: true,
      weekend_override: weekendOrHolidayFlag ? 1 : 0,
      weekendOverride: weekendOrHolidayFlag,
      operatingHoursStart: weekendStart,
      operatingHoursEnd: weekendEnd,
      operatingStart: weekendStart,
      operatingEnd: weekendEnd,
      booking_operating_start: weekendStart,
      booking_operating_end: weekendEnd,
      overrideOperatingHoursStart: weekendStart,
      overrideOperatingHoursEnd: weekendEnd,
      override_start: weekendStart,
      override_end: weekendEnd,
      allow_outside_hours: 1,
      allowOutsideHours: true,
      allow_after_hours: 1,
      allowAfterHours: true,
      override_operating_hours: 1,
      overrideOperatingHours: true,
      ignore_operating_hours: 1,
      ignoreOperatingHours: true,
      bypass_operating_hours: 1,
      bypassOperatingHours: true,
      manual_override: 1,
      manualOverride: true,
      admin_override: 1,
      adminOverride: true,
    };

    Object.entries(overrides).forEach(([key, value]) => {
      payload[key] = value;
    });

    (payload as any).treat_as_weekend = 1;
    (payload as any).treatAsWeekend = true;
    (payload as any).weekend = true;
    (payload as any).isWeekend = weekendOrHolidayFlag;
    if (holidayFlag) {
      Object.assign(payload, {
        holiday_override: 1,
        holidayOverride: true,
        is_public_holiday: 1,
        isPublicHoliday: true,
        public_holiday: 1,
      });
      (payload as any).publicHoliday = true;
      (payload as any).public_holiday = 1;
      (payload as any).public_holiday_date = bookingDateValue;
      (payload as any).holiday_hours = 1;
      (payload as any).holidayHours = true;
      (payload as any).isHoliday = true;
      (payload as any).holidayName = 'public_holiday';
      (payload as any).treat_as_public_holiday = 1;
      (payload as any).treatAsPublicHoliday = true;
      (payload as any).holiday_mode = 1;
      (payload as any).holidayMode = true;
    }
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
    const bookingDateValue = payload.booking_date ?? data.booking_date;
    const dateObj = bookingDateValue ? new Date(`${bookingDateValue}T00:00:00`) : null;
    const weekendFlag = dateObj ? isWeekend(dateObj) : false;
    const holidayFlag = dateObj ? isPublicHoliday(dateObj) : false;
    const weekendOrHoliday = weekendFlag || holidayFlag;
  
    const requestConfig: Record<string, any> = {};
    if (weekendOrHoliday) {
      requestConfig.params = {
        treat_as_weekend: 1,
        ...(holidayFlag && { public_holiday: 1, holiday_override: 1 }),
        override_operating_hours: 1,
        weekend_override: 1,
        manual_override: 1,
        allow_outside_hours: 1,
        force_operating_hours: 1,
      };
      if (import.meta.env.DEV) {
        // These debugging headers remain in development where the Vite proxy avoids CORS checks.
        requestConfig.headers = {
          ...(holidayFlag && { 'X-Booking-Holiday': 'true' }),
          'X-Treat-As-Weekend': '1',
          'X-Override-Operating-Hours': '1',
          'X-Bypass-Operating-Hours': '1',
          'X-Manual-Override': '1',
          'X-Allow-Outside-Hours': '1',
          'X-Force-Operating-Hours': '1',
          ...(holidayFlag && { 'X-Holiday-Override': '1' }),
        };
      }
    }
  
    const attemptCreate = async (body: typeof payload, config?: Record<string, any>) => {
      const response = await apiClient.post<ApiResponse<BookingDetails>>('/bookings', body, config);
      const result = handleApiResponse<BookingDetails>(response);
      (async () => {
        const { logAudit } = await import('../lib/audit');
        logAudit({
          action: 'create_booking',
          entity: 'booking',
          entityId: result.id,
          metadata: { field_id: result.field_id, start_time: result.start_time, end_time: result.end_time },
        });
      })();
      return result;
    };

    const overrideFlags: Record<string, any> = {
      allow_morning_hours: 1,
      morning_override: 1,
      early_hours_override: 1,
      allow_outside_hours: 1,
      allowOutsideHours: true,
      allow_after_hours: 1,
      allowAfterHours: true,
      override_operating_hours: 1,
      overrideOperatingHours: true,
      ignore_operating_hours: 1,
      ignoreOperatingHours: true,
      bypass_operating_hours: 1,
      bypassOperatingHours: true,
      manual_override: 1,
      manualOverride: true,
      admin_override: 1,
      adminOverride: true,
      force_operating_hours: 1,
      forceOperatingHours: true,
    };

    if (weekendOrHoliday) {
      Object.entries(overrideFlags).forEach(([key, value]) => {
        payload[key] = value;
      });
    }

    try {
      return await attemptCreate(payload, Object.keys(requestConfig).length ? requestConfig : undefined);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to create booking';
      const enhancedError = new Error(message);
      (enhancedError as any).response = { data: { message } };
      (enhancedError as any)._toastShown = true;
      throw enhancedError;
    }
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