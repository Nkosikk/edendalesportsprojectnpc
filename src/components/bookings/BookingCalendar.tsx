import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { fieldService } from '../../services/fieldsService';
import LoadingSpinner from '../ui/LoadingSpinner';
import { mergeAvailability, AvailabilityMergedSlot, computeBookingCost, isWeekend, isPublicHoliday, generateHourlySlots, normalizeTimeHM, timeToMinutes } from '../../utils/scheduling';
import Button from '../ui/Button';

interface BookingCalendarProps {
  fieldId: number | null;
  date: Date;
  duration: number; // hours
  hourlyRateOverride?: number;
  initialStartTime?: string; // Pre-select this time slot
  onSelect: (startTime: string, endTime: string, cost: number) => void;
}

const BookingCalendar = ({ fieldId, date, duration, hourlyRateOverride, initialStartTime, onSelect }: BookingCalendarProps) => {
  const normalizedInitialStart = useMemo(() => {
    if (!initialStartTime) return null;
    const normalized = normalizeTimeHM(initialStartTime);
    return normalized || null;
  }, [initialStartTime]);
  const [mergedSlots, setMergedSlots] = useState<AvailabilityMergedSlot[]>([]);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dateStr = toLocalYMD(date);
  const durationHours = Math.max(1, Number(duration) || 1);

  const { data, isLoading, error, refetch } = useQuery(
    ['fieldAvailability', fieldId, dateStr, durationHours],
    async () => {
      if (!fieldId) return undefined;
      try {
        return await fieldService.getFieldAvailability(fieldId, dateStr, durationHours);
      } catch (err: any) {
        console.warn('API availability failed, using fallback:', err.message);
        // Return fallback availability data aligned with operating hours
        const fallbackSlots = generateHourlySlots(date).map(slot => ({
          start_time: slot.start,
          end_time: slot.end,
          available: true,
          blocked: false,
          price: 400,
        }));
        return {
          field: { id: fieldId, hourly_rate: 400 },
          slots: fallbackSlots,
        };
      }
    },
    { 
      enabled: !!fieldId,
      retry: false, // Don't retry since we have fallback
      refetchOnWindowFocus: false
    }
  );

  useEffect(() => {
    // Only clear selection if field or date changes, not duration
    if (fieldId !== null && dateStr) {
      setSelectedStart(null);
    }
  }, [fieldId, dateStr]);

  useEffect(() => {
    const merged = mergeAvailability(date, data);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    if (!sameDay) {
      setMergedSlots(merged);
      return;
    }

    const adjusted = merged.map(slot => {
      const [hourStr, minuteStr] = slot.start.split(':');
      const slotStart = new Date(date);
      slotStart.setHours(Number(hourStr) || 0, Number(minuteStr) || 0, 0, 0);
      const inPast = slotStart <= now;
      return inPast
        ? { ...slot, available: false, past: true }
        : { ...slot, past: false };
    });

    setMergedSlots(adjusted);
  }, [data, date]);

  const durationSlots = useMemo(() => {
    if (!mergedSlots || mergedSlots.length === 0) return [] as Array<{ start: string; end: string; price: number }>;
    const options: Array<{ start: string; end: string; price: number }> = [];
    const hourlyRate = data?.field?.hourly_rate || hourlyRateOverride || 0;
    const requiredMinutes = durationHours * 60;

    for (let i = 0; i < mergedSlots.length; i++) {
      const startSlot = mergedSlots[i];
      if (!startSlot || !startSlot.available || startSlot.blocked || startSlot.past) continue;

      let totalMinutes = 0;
      let totalPrice = 0;
      let lastEnd: string | null = null;
      let valid = true;

      for (let offset = 0; offset < durationHours; offset++) {
        const slot = mergedSlots[i + offset];
        if (!slot || !slot.available || slot.blocked || slot.past) {
          valid = false;
          break;
        }
        if (lastEnd && slot.start !== lastEnd) {
          valid = false;
          break;
        }
        const startMinutes = timeToMinutes(slot.start);
        const endMinutes = timeToMinutes(slot.end);
        if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
          valid = false;
          break;
        }
        totalMinutes += endMinutes - startMinutes;
        totalPrice += Number(slot.price ?? 0);
        lastEnd = slot.end;
      }

      if (valid && totalMinutes === requiredMinutes && lastEnd) {
        const price = totalPrice > 0 ? totalPrice : computeBookingCost(hourlyRate, durationHours);
        options.push({ start: startSlot.start, end: lastEnd, price });
      }
    }

    // Deduplicate by start-end in case of overlapping data
    const unique = new Map<string, { start: string; end: string; price: number }>();
    options.forEach((option) => {
      const key = `${option.start}-${option.end}`;
      if (!unique.has(key)) {
        unique.set(key, option);
      }
    });

    return Array.from(unique.values()).sort((a, b) => a.start.localeCompare(b.start));
  }, [mergedSlots, durationHours, data?.field?.hourly_rate, hourlyRateOverride]);

  // Separate effect for duration changes - reset selection if current start is no longer valid
  useEffect(() => {
    if (selectedStart && mergedSlots.length > 0) {
      const option = durationSlots.find((slot) => slot.start === selectedStart);
      if (!option) {
        setSelectedStart(null);
      }
    }
  }, [durationSlots, selectedStart, mergedSlots.length]);

  // Auto-select initial time when slots are loaded
  useEffect(() => {
    if (normalizedInitialStart && durationSlots.length > 0 && !selectedStart) {
      const option = durationSlots.find(slot => slot.start === normalizedInitialStart);
      if (option) {
        handleSelect(option.start, option.end, option.price);
      }
    }
  }, [normalizedInitialStart, durationSlots, selectedStart]);

  const hourlyRate = hourlyRateOverride || data?.field?.hourly_rate || 400;

  const handleSelect = (start: string, end: string, price: number) => {
    setSelectedStart(start);
    const computedPrice = price > 0 ? price : computeBookingCost(hourlyRate, durationHours);
    onSelect(start, normalizeTimeHM(end), computedPrice);
  };

  if (!fieldId) {
    return <div className="p-4 text-sm text-gray-600">Select a field to view availability.</div>;
  }

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center"><LoadingSpinner size="md" /></div>
    );
  }

  // Show availability even if there was an API error (fallback data)
  if (error && !data) {
    return (
      <div className="p-4 text-error-600 text-sm space-y-2">
        <div>Failed to load availability from server.</div>
        <div className="text-xs text-gray-500">
          Error: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
        <button 
          onClick={() => refetch()}
          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && data ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
          <div className="text-yellow-800">
            ⚠️ Using offline availability data - server connection failed
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {durationSlots.map((slot) => {
          const isSelected = selectedStart === slot.start;
          const buttonClasses = `relative rounded-lg border p-3 text-center text-xs font-medium transition ${
            isSelected
              ? 'ring-2 ring-primary-600 border-primary-600 bg-primary-50 text-primary-700'
              : 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer'
          }`;

          return (
            <button
              key={`${slot.start}-${slot.end}`}
              onClick={() => handleSelect(slot.start, slot.end, slot.price)}
              className={buttonClasses}
            >
              <div className="font-semibold">{slot.start} - {slot.end}</div>
              <div className="mt-1 text-[10px] font-medium">R{Number(slot.price).toFixed(2)}</div>
              <div className="mt-1 text-[10px] font-medium text-green-600">✅ Available</div>
            </button>
          );
        })}
        {durationSlots.length === 0 && (
          <div className="col-span-full bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            No slots match the selected duration. Try choosing a different time, date, or shorter duration.
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-50 border border-green-200 rounded" />
          <span>✅ Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-primary-50 border border-primary-600 rounded" />
          <span>Selected</span>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-2">
        <div>
          Operating Hours: {isWeekend(date) || isPublicHoliday(date) ? 'Weekend / Public Holiday 09:00-22:00' : 'Weekday 16:00-22:00'}
        </div>
        <div className="mt-1">Selected duration: {durationHours} hour{durationHours > 1 ? 's' : ''}</div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      </div>
    </div>
  );
};

export default BookingCalendar;
