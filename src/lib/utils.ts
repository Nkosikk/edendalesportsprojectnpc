import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { BookingDetails } from '../types';
import { UserRole } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  } catch (error) {
    console.warn('Invalid date format:', date);
    return '—';
  }
};

export const formatTime = (value: string | Date | null | undefined) => {
  if (!value) return '—';
  
  try {
    // Handle plain HH:MM time strings directly
    if (typeof value === 'string') {
      const s = value.trim();
      // e.g., "21:00"
      if (/^\d{2}:\d{2}$/.test(s)) return s;
      // Some backends send "YYYY-MM-DD HH:MM"; convert to ISO-like for Date parsing
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) {
        const iso = s.replace(' ', 'T');
        const d = new Date(iso);
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('en-ZA', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(d);
        }
      }
      // Direct string fallback
      return s;
    }

    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) {
      // Fallback: return the original string to avoid runtime errors
      return typeof value === 'string' ? value : '—';
    }
    return new Intl.DateTimeFormat('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch (error) {
    console.warn('Invalid time format:', value);
    return '—';
  }
};

export const formatDateTime = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date));
};

export const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'R0.00';
  }
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  } catch (error) {
    console.warn('Invalid currency amount:', amount);
    return `R${Number(amount || 0).toFixed(2)}`;
  }
};

export const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const getInitials = (firstName: string, lastName: string) => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export const truncateText = (text: string, maxLength: number = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const coerceTime = (time?: string | null) => {
  if (!time) return '00:00:00';
  if (time.length === 5) return `${time}:00`;
  if (time.length === 8) return time;
  return time;
};

const parseDateAndTime = (date?: string | null, time?: string | null): Date | null => {
  if (!date || !time) return null;
  const trimmedTime = time.trim();

  // Some backends return timestamps directly (e.g., "2025-12-07 10:00:00")
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmedTime)) {
    const directCandidate = trimmedTime.includes('T') ? trimmedTime : trimmedTime.replace(' ', 'T');
    const direct = new Date(directCandidate);
    if (!isNaN(direct.getTime())) return direct;
  }

  const isoCandidate = `${date}T${coerceTime(trimmedTime)}`;
  const parsed = new Date(isoCandidate);
  if (!isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(`${date} ${trimmedTime}`);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const parseBookingDateTime = (booking?: Pick<BookingDetails, 'booking_date' | 'start_time'> | null) => {
  if (!booking?.booking_date || !booking?.start_time) return null;
  const parsed = parseDateAndTime(booking.booking_date, booking.start_time);
  return parsed;
};

const parseBookingEndDateTime = (booking?: Pick<BookingDetails, 'booking_date' | 'end_time'> | null) => {
  if (!booking?.booking_date || !booking?.end_time) return null;
  const parsed = parseDateAndTime(booking.booking_date, booking.end_time);
  return parsed;
};

export const hoursUntilBookingStart = (
  booking?: Pick<BookingDetails, 'booking_date' | 'start_time'> | null
): number | null => {
  const start = parseBookingDateTime(booking);
  if (!start) return null;
  const diffMs = start.getTime() - Date.now();
  return diffMs / (1000 * 60 * 60);
};

export const hasBookingEnded = (
  booking?: Pick<BookingDetails, 'booking_date' | 'end_time'> | null
): boolean => {
  const end = parseBookingEndDateTime(booking);
  if (!end) return false;
  return end.getTime() <= Date.now();
};

const isPrivilegedRole = (role?: string | UserRole | null) => {
  if (!role) return false;
  const normalized = typeof role === 'string' ? role.toLowerCase() : role;
  return normalized === UserRole.Admin || normalized === UserRole.Staff;
};

export const canUserCancelBooking = (
  booking: BookingDetails | null | undefined,
  role?: string | UserRole | null
): boolean => {
  if (!booking) return false;
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
  if (isPrivilegedRole(role)) return true;
  const hoursUntil = hoursUntilBookingStart(booking);
  if (hoursUntil === null) return true;
  return hoursUntil >= 24;
};

export const getCancellationRestrictionMessage = (
  booking: BookingDetails | null | undefined,
  role?: string | UserRole | null
): string | null => {
  if (!booking) return null;
  if (booking.status === 'cancelled') return 'Booking already cancelled.';
  if (booking.status === 'completed') return 'Completed bookings cannot be cancelled.';
  if (isPrivilegedRole(role)) return null;
  const hoursUntil = hoursUntilBookingStart(booking);
  if (hoursUntil !== null && hoursUntil < 24) {
    return 'Cancellations are only allowed up to 24 hours before start time.';
  }
  return null;
};

const REFUND_KEYS = [
  'refund_amount',
  'refundAmount',
  'refund',
  'amount_refund',
  'amountRefund',
  'refund_due',
  'refundDue',
  'amount_due_customer',
  'amount_due_to_customer',
  'customer_refund',
];

const BALANCE_KEYS = [
  'balance',
  'balance_due',
  'amount_due',
  'amountDue',
  'outstanding_balance',
  'outstandingBalance',
];

const coerceRefundValue = (source: any): number | undefined => {
  for (const key of REFUND_KEYS) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      const value = safeNumber(source[key], NaN);
      if (!Number.isNaN(value)) return value;
    }
  }
  return undefined;
};

const coerceNegativeBalance = (source: any): number | undefined => {
  for (const key of BALANCE_KEYS) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      const value = safeNumber(source[key], NaN);
      if (!Number.isNaN(value) && value < 0) return value;
    }
  }
  return undefined;
};

export const getExplicitRefundAmount = (
  booking: BookingDetails | null | undefined
): number | null => {
  if (!booking) return null;
  const value = coerceRefundValue(booking);
  if (value === undefined || Number.isNaN(value)) return null;
  return Math.abs(value);
};

export const getRefundAdjustedAmount = (
  booking: BookingDetails | null | undefined
): number => {
  if (!booking) return 0;
  const refundValue = coerceRefundValue(booking);
  if (refundValue !== undefined && refundValue > 0) {
    return -Math.abs(refundValue);
  }

  const negativeBalance = coerceNegativeBalance(booking);
  if (negativeBalance !== undefined) {
    return negativeBalance;
  }

  const total = safeNumber((booking as any)?.total_amount ?? (booking as any)?.amount ?? 0);
  if (
    booking.status === 'cancelled' &&
    (booking.payment_status === 'paid' || booking.payment_status === 'refunded') &&
    total > 0
  ) {
    return -Math.abs(total);
  }

  return total;
};

export const shouldAutoCompleteBooking = (booking: BookingDetails | null | undefined): boolean => {
  if (!booking) return false;
  if (booking.status !== 'confirmed') return false;
  if (booking.payment_status !== 'paid') return false;
  return hasBookingEnded(booking);
};