// Scheduling utilities: operating hours & slot generation
export const WEEKDAY_START_HOUR = 16;
export const WEEKDAY_END_HOUR = 22; // exclusive end
export const WEEKEND_START_HOUR = 9;
export const WEEKEND_END_HOUR = 22; // exclusive end

// Basic SA public holidays (MM-DD). Adjust as needed.
const PUBLIC_HOLIDAYS: string[] = [
  '01-01', // New Year's Day
  '03-21', // Human Rights Day
  '04-27', // Freedom Day
  '05-01', // Workers' Day
  '06-16', // Youth Day
  '08-09', // National Women's Day
  '09-24', // Heritage Day
  '12-16', // Day of Reconciliation
  '12-25', // Christmas Day
  '12-26', // Day of Goodwill
];

export const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const sanitizeNumber = (value: string | number | undefined, fallback = 0) => {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return num;
};

export const normalizeTimeHM = (time: string | null | undefined): string => {
  if (!time) return '';
  const parts = time.split(':');
  const hour = Math.min(23, Math.max(0, sanitizeNumber(parts[0], 0)));
  const minute = Math.min(59, Math.max(0, sanitizeNumber(parts[1], 0)));
  return `${pad(hour)}:${pad(minute)}`;
};

export const toApiTime = (time: string | null | undefined): string => {
  if (!time) return '';
  const parts = time.split(':');
  const hour = Math.min(23, Math.max(0, sanitizeNumber(parts[0], 0)));
  const minute = Math.min(59, Math.max(0, sanitizeNumber(parts[1], 0)));
  const second = Math.min(59, Math.max(0, sanitizeNumber(parts[2], 0)));
  return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
};

export interface HourSlot {
  start: string; // HH:MM
  end: string;   // HH:MM
}

export const isWeekend = (date: Date) => {
  const day = date.getDay(); // 0 Sun .. 6 Sat
  return day === 0 || day === 6;
};

export const isPublicHoliday = (date: Date) => {
  const key = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return PUBLIC_HOLIDAYS.includes(key);
};

export const getOperatingHours = (date: Date): { startHour: number; endHour: number } => {
  if (isWeekend(date) || isPublicHoliday(date)) {
    return { startHour: WEEKEND_START_HOUR, endHour: WEEKEND_END_HOUR };
  }
  return { startHour: WEEKDAY_START_HOUR, endHour: WEEKDAY_END_HOUR };
};

export const generateHourlySlots = (date: Date): HourSlot[] => {
  const { startHour, endHour } = getOperatingHours(date);
  const slots: HourSlot[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push({ start: `${pad(h)}:00`, end: `${pad(h + 1)}:00` });
  }
  return slots;
};

// Merge base operating slots with availability from API
export interface AvailabilityMergedSlot extends HourSlot {
  available: boolean;
  blocked?: boolean;
  blockReason?: string;
  price?: number;
}

interface FieldAvailabilityLike {
  slots?: Array<{ start_time: string; end_time: string; available: boolean; price: number }>;
  blocked_slots?: Array<{ start_time: string; end_time: string; status: string; reason?: string }>;
}

export const mergeAvailability = (
  date: Date,
  availability?: FieldAvailabilityLike
): AvailabilityMergedSlot[] => {
  const base = generateHourlySlots(date);
  if (!availability) return base.map(s => ({ ...s, available: true }));

  const blockedMap = new Map<string, { status: string; reason?: string }>();
  availability.blocked_slots?.forEach(b => {
    const start = normalizeTimeHM(b.start_time);
    const end = normalizeTimeHM(b.end_time);
    blockedMap.set(`${start}-${end}`, { status: b.status, reason: b.reason });
  });

  const availMap = new Map<string, { available: boolean; price: number }>();
  availability.slots?.forEach(s => {
    const start = normalizeTimeHM(s.start_time);
    const end = normalizeTimeHM(s.end_time);
    availMap.set(`${start}-${end}`, { available: s.available, price: s.price });
  });

  return base.map(slot => {
    const key = `${slot.start}-${slot.end}`;
    const avail = availMap.get(key);
    const block = blockedMap.get(key);
    return {
      ...slot,
      available: avail ? avail.available : true,
      blocked: !!block,
      blockReason: block?.reason,
      price: avail?.price,
    };
  });
};

export const computeBookingCost = (hourlyRate: number, hours: number) => hourlyRate * hours;
