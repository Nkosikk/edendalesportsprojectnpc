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

const extractTimeParts = (value: string | null | undefined): [number, number, number] => {
  if (!value) return [0, 0, 0];
  // Supports "HH:mm", "HH:mm:ss" as well as full timestamps like "2025-11-24 18:00:00"
  const match = String(value).match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (match) {
    const [, h, m, s] = match;
    return [sanitizeNumber(h, 0), sanitizeNumber(m, 0), sanitizeNumber(s, 0)];
  }
  const parts = String(value).split(':');
  return [sanitizeNumber(parts[0], 0), sanitizeNumber(parts[1], 0), sanitizeNumber(parts[2], 0)];
};

export const normalizeTimeHM = (time: string | null | undefined): string => {
  if (!time) return '';
  const [rawHour, rawMinute] = extractTimeParts(time);
  const hour = Math.min(23, Math.max(0, rawHour));
  const minute = Math.min(59, Math.max(0, rawMinute));
  return `${pad(hour)}:${pad(minute)}`;
};

export const toApiTime = (time: string | null | undefined): string => {
  if (!time) return '';
  const [rawHour, rawMinute, rawSecond] = extractTimeParts(time);
  const hour = Math.min(23, Math.max(0, rawHour));
  const minute = Math.min(59, Math.max(0, rawMinute));
  const second = Math.min(59, Math.max(0, rawSecond));
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
  past?: boolean;
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
    if (!start || !end) return;
    const [startHour, startMinute] = extractTimeParts(start);
    const [endHour, endMinute] = extractTimeParts(end);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    if (endMinutes <= startMinutes) return;

    const stepMinutes = 60;
    for (let cursor = startMinutes; cursor < endMinutes; cursor += stepMinutes) {
      const segmentStartHour = Math.floor(cursor / 60);
      const segmentStartMinute = cursor % 60;
      const segmentEndMinutes = Math.min(cursor + stepMinutes, endMinutes);
      const segmentEndHour = Math.floor(segmentEndMinutes / 60);
      const segmentEndMinute = segmentEndMinutes % 60;
      blockedMap.set(`${pad(segmentStartHour)}:${pad(segmentStartMinute)}-${pad(segmentEndHour)}:${pad(segmentEndMinute)}`, { status: b.status, reason: b.reason });
    }
  });

  const availMap = new Map<string, { available: boolean; price: number }>();
  availability.slots?.forEach(s => {
    const start = normalizeTimeHM(s.start_time);
    const end = normalizeTimeHM(s.end_time);
    if (!start || !end) return;

    const [startHour, startMinute] = extractTimeParts(start);
    const [endHour, endMinute] = extractTimeParts(end);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    if (endMinutes <= startMinutes) return;

    const stepMinutes = 60;
    for (let cursor = startMinutes; cursor < endMinutes; cursor += stepMinutes) {
      const segmentStartHour = Math.floor(cursor / 60);
      const segmentStartMinute = cursor % 60;
      const segmentEndMinutes = Math.min(cursor + stepMinutes, endMinutes);
      const segmentEndHour = Math.floor(segmentEndMinutes / 60);
      const segmentEndMinute = segmentEndMinutes % 60;
      const segmentStart = `${pad(segmentStartHour)}:${pad(segmentStartMinute)}`;
      const segmentEnd = `${pad(segmentEndHour)}:${pad(segmentEndMinute)}`;
      const key = `${segmentStart}-${segmentEnd}`;
      const existing = availMap.get(key);
      const price = Number.isFinite(Number(s.price)) ? Number(s.price) : existing?.price;
      const available = existing ? existing.available && Boolean(s.available) : Boolean(s.available);
      availMap.set(key, { available, price: price ?? 0 });
    }
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
