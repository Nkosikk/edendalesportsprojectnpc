import { describe, it, expect } from 'vitest';
import {
  canUserCancelBooking,
  getRefundAdjustedAmount,
} from './utils';
import type { BookingDetails } from '../types';

const baseBooking: BookingDetails = {
  id: 1,
  booking_reference: 'TEST-001',
  user_id: 1,
  first_name: 'Test',
  last_name: 'User',
  email: 'test@example.com',
  field_id: 1,
  field_name: 'Main Field',
  sport_type: 'football',
  booking_date: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().split('T')[0],
  start_time: '10:00:00',
  end_time: '12:00:00',
  duration_hours: 2,
  hourly_rate: 200,
  total_amount: 400,
  status: 'pending',
  payment_status: 'pending',
  payment_method: 'online',
  notes: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  phone: '+2700000000',
};

const withOverrides = (overrides: Partial<BookingDetails>): BookingDetails => ({
  ...baseBooking,
  ...overrides,
});

const isoParts = (date: Date) => {
  const [datePart, timePart] = date.toISOString().split('T');
  return {
    date: datePart,
    time: timePart.slice(0, 8),
  };
};

describe('canUserCancelBooking', () => {
  it('allows customers to cancel when booking is more than 24 hours away', () => {
    const futureStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const { date, time } = isoParts(futureStart);
    const booking = withOverrides({ booking_date: date, start_time: time });
    expect(canUserCancelBooking(booking, 'customer')).toBe(true);
  });

  it('prevents customers from cancelling within 24 hours', () => {
    const soonStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { date, time } = isoParts(soonStart);
    const booking = withOverrides({ booking_date: date, start_time: time });
    expect(canUserCancelBooking(booking, 'customer')).toBe(false);
  });

  it('always allows admins to cancel regardless of timing', () => {
    const soonStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { date, time } = isoParts(soonStart);
    const booking = withOverrides({ booking_date: date, start_time: time });
    expect(canUserCancelBooking(booking, 'admin')).toBe(true);
  });
});

describe('getRefundAdjustedAmount', () => {
  it('returns negative amount when explicit refund is provided', () => {
    const booking = withOverrides({ refund_amount: 400, status: 'cancelled', payment_status: 'paid' });
    expect(getRefundAdjustedAmount(booking)).toBe(-400);
  });

  it('defaults to negative total when cancelled and paid without explicit refund field', () => {
    const booking = withOverrides({ status: 'cancelled', payment_status: 'paid', refund_amount: undefined });
    expect(getRefundAdjustedAmount(booking)).toBe(-Math.abs(baseBooking.total_amount));
  });

  it('keeps positive total for active bookings', () => {
    const booking = withOverrides({ status: 'confirmed', payment_status: 'pending' });
    expect(getRefundAdjustedAmount(booking)).toBe(baseBooking.total_amount);
  });
});
