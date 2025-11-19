// Scheduling utilities: operating hours & slot generation
export const WEEKDAY_START_HOUR = 16;
export const WEEKDAY_END_HOUR = 22; // exclusive end
export const WEEKEND_START_HOUR = 9;
export const WEEKEND_END_HOUR = 22; // exclusive end

export interface HourSlot {
  start: string; // HH:MM
  end: string;   // HH:MM
}

export const isWeekend = (date: Date) => {
  const day = date.getDay(); // 0 Sun .. 6 Sat
  return day === 0 || day === 6;
};

export const getOperatingHours = (date: Date): { startHour: number; endHour: number } => {
  if (isWeekend(date)) {
    return { startHour: WEEKEND_START_HOUR, endHour: WEEKEND_END_HOUR };
  }
  return { startHour: WEEKDAY_START_HOUR, endHour: WEEKDAY_END_HOUR };
};

export const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

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
    blockedMap.set(`${b.start_time}-${b.end_time}`, { status: b.status, reason: b.reason });
  });

  const availMap = new Map<string, { available: boolean; price: number }>();
  availability.slots?.forEach(s => {
    availMap.set(`${s.start_time}-${s.end_time}`, { available: s.available, price: s.price });
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
