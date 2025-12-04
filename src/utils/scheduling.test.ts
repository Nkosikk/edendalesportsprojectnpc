import { describe, it, expect } from 'vitest';
import { mergeAvailability } from './scheduling';

describe('mergeAvailability', () => {
  const sampleDate = new Date('2025-12-27T00:00:00'); // Saturday, weekend hours

  it('marks each hour within a multi-hour unavailable slot as unavailable', () => {
    const availability = {
      slots: [
        {
          start_time: '09:00',
          end_time: '11:00',
          available: false,
          price: 400,
        },
      ],
    };

    const merged = mergeAvailability(sampleDate, availability);
    const nineAm = merged.find((slot) => slot.start === '09:00');
    const tenAm = merged.find((slot) => slot.start === '10:00');

    expect(nineAm?.available).toBe(false);
    expect(tenAm?.available).toBe(false);
  });

  it('marks blocked multi-hour ranges as blocked for each constituent hour', () => {
    const availability = {
      slots: [],
      blocked_slots: [
        {
          start_time: '12:00',
          end_time: '14:00',
          status: 'blocked',
          reason: 'Maintenance',
        },
      ],
    };

    const merged = mergeAvailability(sampleDate, availability);
    const noon = merged.find((slot) => slot.start === '12:00');
    const onePm = merged.find((slot) => slot.start === '13:00');

    expect(noon?.blocked).toBe(true);
    expect(onePm?.blocked).toBe(true);
  });
});
