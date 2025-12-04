import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { fieldService } from '../../services/fieldsService';
import LoadingSpinner from '../ui/LoadingSpinner';
import { mergeAvailability, AvailabilityMergedSlot, computeBookingCost, isWeekend, isPublicHoliday, generateHourlySlots, normalizeTimeHM } from '../../utils/scheduling';
import Button from '../ui/Button';
import toast from 'react-hot-toast';

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

  // Separate effect for duration changes - validate current selection
  useEffect(() => {
    if (selectedStart && mergedSlots.length > 0) {
      const startIndex = mergedSlots.findIndex(s => s.start === selectedStart);
      if (startIndex !== -1) {
        // Check if current selection is still valid with new duration
        let stillValid = true;
        for (let i = 0; i < durationHours; i++) {
          const slot = mergedSlots[startIndex + i];
          if (!slot || !slot.available || slot.blocked || slot.past) {
            stillValid = false;
            break;
          }
        }
        if (!stillValid) {
          setSelectedStart(null);
        }
      }
    }
  }, [durationHours, mergedSlots, selectedStart]);

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

  // Auto-select initial time when slots are loaded
  useEffect(() => {
    if (normalizedInitialStart && mergedSlots.length > 0 && !selectedStart) {
      const startSlot = mergedSlots.find(slot => slot.start === normalizedInitialStart);
      if (startSlot && startSlot.available && !startSlot.blocked) {
        // Check if we can select the full duration from this start time
        const startIndex = mergedSlots.findIndex(s => s.start === normalizedInitialStart);
        let canSelect = true;
        for (let i = 0; i < durationHours && canSelect; i++) {
          const slot = mergedSlots[startIndex + i];
          if (!slot || !slot.available || slot.blocked) {
            canSelect = false;
          }
        }
        if (canSelect) {
          handleSelect(normalizedInitialStart);
        }
      }
    }
  }, [normalizedInitialStart, mergedSlots, selectedStart, durationHours]);

  const hourlyRate = hourlyRateOverride || data?.field?.hourly_rate || 400;

  const handleSelect = (start: string) => {
    // Guard: ensure starting slot exists
    const startIndex = mergedSlots.findIndex(s => s.start === start);
    if (startIndex === -1) return;

    // Validate availability across the duration
    for (let i = 0; i < durationHours; i++) {
      const s = mergedSlots[startIndex + i];
      if (!s || !s.available || s.blocked || s.past) {
        toast.dismiss('unavailable-range');
        const endSlot = mergedSlots[startIndex + durationHours - 1];
        const endTime = endSlot?.end || `${start.split(':')[0]}:00`;
        let message = `Cannot book ${start}-${endTime}: `;
        if (s?.blocked) message += 'slot is blocked for maintenance';
        else if (s?.past) message += 'time has already passed';
        else message += 'slot is unavailable';
        toast.error(message, { id: 'unavailable-range' });
        return;
      }
    }

    const endSlot = mergedSlots[startIndex + durationHours - 1];
    const endTime = endSlot.end;
    setSelectedStart(start);
    const cost = computeBookingCost(hourlyRate, durationHours);
    onSelect(start, endTime, cost);
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {mergedSlots.map((slot, idx) => {
          const isSelected = selectedStart === slot.start;
          const baseUnavailable = !slot.available || slot.blocked || !!slot.past;
          const canStartHere = (() => {
            if (baseUnavailable) return false;
            for (let i = 0; i < durationHours; i++) {
              const s = mergedSlots[idx + i];
              if (!s || !s.available || s.blocked || s.past) return false;
            }
            return true;
          })();
          const disabled = baseUnavailable || !canStartHere;
          const isBooked = !slot.available && !slot.blocked && !slot.past;
          const isAvailable = !disabled && slot.available && !slot.blocked && !slot.past;
          const title = !baseUnavailable && !canStartHere
            ? 'Not enough continuous availability for selected duration'
            : undefined;
          
          // Enhanced styling similar to home page
          let buttonClasses = 'relative rounded-lg border p-3 text-center text-xs font-medium transition ';
          
          if (isSelected) {
            buttonClasses += 'ring-2 ring-primary-600 border-primary-600 bg-primary-50 text-primary-700 ';
          } else if (isAvailable) {
            buttonClasses += 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100 cursor-pointer ';
          } else if (isBooked) {
            buttonClasses += 'border-red-200 bg-red-50 text-red-600 cursor-not-allowed ';
          } else if (slot.blocked) {
            buttonClasses += 'border-orange-200 bg-orange-50 text-orange-600 cursor-not-allowed ';
          } else if (slot.past) {
            buttonClasses += 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed ';
          } else {
            buttonClasses += 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed ';
          }
          
          return (
            <button
              key={slot.start}
              disabled={disabled}
              title={title}
              onClick={() => handleSelect(slot.start)}
              className={buttonClasses}
            >
              <div className="font-semibold">{slot.start} - {slot.end}</div>
              {slot.price && isAvailable && (
                <div className="mt-1 text-[10px] font-medium">R{Number(slot.price).toFixed(0)}</div>
              )}
              {slot.blocked && (
                <div className="mt-1 text-[10px] font-medium">🚫 Blocked</div>
              )}
              {!slot.blocked && slot.past && (
                <div className="mt-1 text-[10px] font-medium">⏳ Past</div>
              )}
              {!slot.blocked && !slot.available && (
                <div className="mt-1 text-[10px] font-medium">📅 Booked</div>
              )}
              {!baseUnavailable && !canStartHere && (
                <div className="mt-1 text-[10px] font-medium">⏱️ Too Short</div>
              )}
              {isAvailable && (
                <div className="mt-1 text-[10px] font-medium text-green-600">✅ Available</div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-50 border border-green-200 rounded" /> 
          <span>✅ Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-50 border border-red-200 rounded" /> 
          <span>📅 Booked</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-orange-50 border border-orange-200 rounded" /> 
          <span>🚫 Blocked</span>
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
