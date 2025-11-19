import { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { fieldService } from '../../services/fieldsService';
import LoadingSpinner from '../ui/LoadingSpinner';
import { mergeAvailability, AvailabilityMergedSlot, computeBookingCost, getOperatingHours } from '../../utils/scheduling';
import Button from '../ui/Button';
import toast from 'react-hot-toast';

interface BookingCalendarProps {
  fieldId: number | null;
  date: Date;
  duration: number; // hours
  hourlyRateOverride?: number;
  onSelect: (startTime: string, endTime: string, cost: number) => void;
}

const BookingCalendar = ({ fieldId, date, duration, hourlyRateOverride, onSelect }: BookingCalendarProps) => {
  const [mergedSlots, setMergedSlots] = useState<AvailabilityMergedSlot[]>([]);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  const dateStr = date.toISOString().split('T')[0];

  // Check if time slot is within operating hours
  const isWithinOperatingHours = (timeStr: string) => {
    const hour = parseInt(timeStr.split(':')[0]);
    const { startHour, endHour } = getOperatingHours(date);
    return hour >= startHour && hour < endHour;
  };

  const { data, isLoading, error, refetch } = useQuery(
    ['fieldAvailability', fieldId, dateStr],
    () => fieldId ? fieldService.getFieldAvailability(fieldId, dateStr, duration) : Promise.resolve(undefined as any),
    { enabled: !!fieldId }
  );

  useEffect(() => {
    setSelectedStart(null);
  }, [fieldId, dateStr, duration]);

  useEffect(() => {
    setMergedSlots(mergeAvailability(date, data));
  }, [data, date]);

  const hourlyRate = hourlyRateOverride || data?.field?.hourly_rate || 400;

  const handleSelect = (start: string) => {
    // Guard: ensure starting slot exists
    const startIndex = mergedSlots.findIndex(s => s.start === start);
    if (startIndex === -1) return;

    // Validate operating hours for span based on start hour and duration
    const startHour = parseInt(start.split(':')[0]);
    const { startHour: ohStart, endHour: ohEnd } = getOperatingHours(date);
    if (startHour < ohStart || startHour + duration > ohEnd) {
      toast.dismiss('outside-hours');
      toast.error('Slot outside operating hours', { id: 'outside-hours' });
      return;
    }

    // Validate availability across the duration
    for (let i = 0; i < duration; i++) {
      const s = mergedSlots[startIndex + i];
      if (!s || !s.available || s.blocked) {
        toast.dismiss('unavailable-range');
        toast.error('Selected range includes unavailable hours', { id: 'unavailable-range' });
        return;
      }
    }

    const endSlot = mergedSlots[startIndex + duration - 1];
    const endTime = endSlot.end;
    setSelectedStart(start);
    const cost = computeBookingCost(hourlyRate, duration);
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

  if (error) {
    return <div className="p-4 text-error-600 text-sm">Failed to load availability.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {mergedSlots.map((slot, idx) => {
          const isSelected = selectedStart === slot.start;
          const withinHours = isWithinOperatingHours(slot.start);
          const baseUnavailable = !slot.available || slot.blocked || !withinHours;
          const canStartHere = (() => {
            if (baseUnavailable) return false;
            for (let i = 0; i < duration; i++) {
              const s = mergedSlots[idx + i];
              if (!s || !s.available || s.blocked || !isWithinOperatingHours(s.start)) return false;
            }
            return true;
          })();
          const disabled = baseUnavailable || !canStartHere;
          const title = !withinHours 
            ? 'Outside operating hours'
            : !baseUnavailable && !canStartHere
            ? 'Not enough continuous availability for selected duration'
            : undefined;
          return (
            <button
              key={slot.start}
              disabled={disabled}
              title={title}
              onClick={() => handleSelect(slot.start)}
              className={`
                relative rounded-lg border p-3 text-center text-xs font-medium transition
                ${disabled ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white hover:bg-primary-50'}
                ${isSelected ? 'ring-2 ring-primary-600 border-primary-600' : ''}
              `}
            >
              <div>{slot.start} - {slot.end}</div>
              {slot.blocked && (
                <div className="mt-1 text-[10px] text-error-600">Blocked</div>
              )}
              {!slot.blocked && !withinHours && (
                <div className="mt-1 text-[10px] text-gray-500">Closed</div>
              )}
              {!slot.blocked && withinHours && !slot.available && (
                <div className="mt-1 text-[10px] text-gray-600">Booked</div>
              )}
              {withinHours && !baseUnavailable && !canStartHere && (
                <div className="mt-1 text-[10px] text-gray-600">Too short</div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-white border rounded" /> Available</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-300 rounded" /> Booked</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-200 rounded" /> Closed / Unavailable</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-primary-600 rounded" /> Selected Start</div>
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Operating Hours: {date.getDay() === 0 || date.getDay() === 6 ? 'Weekend 09:00-22:00' : 'Weekday 16:00-22:00'}
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      </div>
    </div>
  );
};

export default BookingCalendar;
