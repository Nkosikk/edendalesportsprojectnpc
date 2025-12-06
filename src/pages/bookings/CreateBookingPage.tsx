import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { fieldService } from '../../services/fieldsService';
import { bookingService } from '../../services/bookingService';
import BookingCalendar from '../../components/bookings/BookingCalendar';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { SportsField } from '../../types';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { normalizeTimeHM } from '../../utils/scheduling';
import { useAuth } from '../../contexts/AuthContext';

const CreateBookingPage = () => {
  const { user } = useAuth();
  const [fieldId, setFieldId] = useState<number | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  // Helper: format date using local timezone components (avoids UTC day shift)
  const formatLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const [duration, setDuration] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [cost, setCost] = useState<number>(0);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const profileIncomplete = useMemo(() => {
    if (!user) return true;
    const hasFirst = Boolean(user.first_name && user.first_name.trim().length > 1);
    const hasLast = Boolean(user.last_name && user.last_name.trim().length > 1);
    const hasPhone = Boolean(user.phone && user.phone.trim().length >= 10);
    return !(hasFirst && hasLast && hasPhone);
  }, [user]);

  const { data: fields = [], isLoading: loadingFields } = useQuery<SportsField[]>(
    ['fields'],
    () => fieldService.getAllFields(true),
    { 
      staleTime: 5 * 60 * 1000,
      retry: 2,
      onError: (err: any) => {
        console.error('Failed to load fields:', err);
      }
    }
  );

  const createMutation = useMutation(
    async () => {
      if (profileIncomplete) throw new Error('Please complete your profile before creating a booking');
      if (!fieldId || !date || !startTime || !endTime) throw new Error('Incomplete booking details');
      return bookingService.createBooking({
        field_id: fieldId,
        booking_date: formatLocalYMD(date),
        start_time: normalizeTimeHM(startTime),
        end_time: normalizeTimeHM(endTime),
        duration_hours: duration,
        notes: notes || undefined,
      });
    },
    {
      onSuccess: () => {
        toast.success('Booking created successfully');
        qc.invalidateQueries(['bookings']);
        navigate('/app/bookings');
      },
      onError: (e: any) => {
        const message = e?.response?.data?.message || e.message || 'Failed to create booking';
        const normalizedMessage = message.toLowerCase();
        
        // Suppress operating hours errors since we removed frontend validation
        if (normalizedMessage.includes('operating') && normalizedMessage.includes('hours')) {
          return; // Don't show the error toast
        }
        
        // Prevent duplicate toasts
        if (!(e as any)?._toastShown) {
          toast.error(message);
          (e as any)._toastShown = true;
        }
      }
    }
  );

  const handleSelectSlot = (start: string, end: string, computedCost: number) => {
    setStartTime(start);
    setEndTime(end);
    setCost(computedCost);
  };

  // Pre-populate from URL parameters (from saved booking intent) & clamp to range
  useEffect(() => {
    const fieldParam = searchParams.get('field_id');
    const dateParam = searchParams.get('date');
    const startParam = searchParams.get('start_time');
    const endParam = searchParams.get('end_time');
    const durationParam = searchParams.get('duration');

    if (fieldParam) setFieldId(Number(fieldParam));
    if (dateParam) {
      const incoming = new Date(dateParam + 'T00:00:00');
      // Clamp incoming date to allowed range
      if (incoming < new Date(formatLocalYMD(today) + 'T00:00:00')) {
        setDate(new Date(formatLocalYMD(today) + 'T00:00:00'));
      } else if (incoming > maxDate) {
        setDate(new Date(formatLocalYMD(maxDate) + 'T00:00:00'));
      } else {
        setDate(incoming);
      }
    }
    if (startParam) setStartTime(startParam);
    if (endParam) setEndTime(endParam);
    if (durationParam) {
      const parsedDuration = Number(durationParam);
      if (Number.isFinite(parsedDuration) && parsedDuration > 0) {
        const clamped = Math.min(Math.max(Math.round(parsedDuration), 1), 4);
        setDuration(clamped);
      }
    }
  }, [searchParams]);

  // Reset any previously selected slot when field/date/duration changes to avoid stale summary
  useEffect(() => {
    // Only reset if not coming from URL params
    if (!searchParams.get('start_time')) {
      setStartTime(null);
      setEndTime(null);
      setCost(0);
    }
  }, [fieldId, date, duration, searchParams]);

  const disabledSubmit = profileIncomplete || !fieldId || !date || !startTime || !endTime || cost <= 0 || createMutation.isLoading;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Booking</h1>
            <p className="text-gray-600 text-sm mt-1">Select a field, date and time slot to book.</p>
          </div>
          {profileIncomplete && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Complete your profile before booking</p>
                <p className="text-xs sm:text-sm text-yellow-800/90 mt-1">We need your full name and contact number to confirm reservations. Please update your profile and then return to book a field.</p>
              </div>
              <Link to="/app/profile" className="w-full sm:w-auto">
                <Button size="sm" className="w-full">Update Profile</Button>
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Field & Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg border">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Field</label>
              {loadingFields ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <select
                    value={fieldId ?? ''}
                    onChange={e => setFieldId(e.target.value ? Number(e.target.value) : null)}
                    className="input text-sm"
                  >
                    <option value="">Select Field</option>
                    {fields && fields.length > 0 ? (
                      fields.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))
                    ) : null}
                  </select>
                  {!loadingFields && (!fields || fields.length === 0) && (
                    <p className="mt-1 text-xs text-red-600">No fields available. Please check back later.</p>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date ? formatLocalYMD(date) : ''}
                min={formatLocalYMD(today)}
                max={formatLocalYMD(maxDate)}
                onChange={e => {
                  if (!e.target.value) {
                    setDate(null);
                    return;
                  }
                  const picked = new Date(e.target.value + 'T00:00:00');
                  // Clamp again just in case (older browsers, manual edits)
                  if (picked < new Date(formatLocalYMD(today) + 'T00:00:00')) {
                    setDate(new Date(formatLocalYMD(today) + 'T00:00:00'));
                  } else if (picked > maxDate) {
                    setDate(new Date(formatLocalYMD(maxDate) + 'T00:00:00'));
                  } else {
                    setDate(picked);
                  }
                }}
                className="input text-sm"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Duration (hours)</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="input text-sm"
              >
                {[1,2,3,4].map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white p-4 rounded-lg border">
            {date ? (
              <BookingCalendar
                fieldId={fieldId}
                date={date}
                duration={duration}
                onSelect={handleSelectSlot}
              />
            ) : (
              <div className="text-sm text-gray-600">
                Select a date to view available time slots.
              </div>
            )}
          </div>

          {/* Notes & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border flex flex-col space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="input text-sm resize-none"
                  placeholder="Any special requirements or comments"
                />
              </div>
              {fieldId && (() => {
                const selectedField = fields?.find(f => f.id === fieldId);
                return selectedField?.rules ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-yellow-800 mb-1">Field Rules & Guidelines:</h4>
                    <p className="text-xs text-yellow-700 whitespace-pre-line">{selectedField.rules}</p>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="bg-white p-4 rounded-lg border space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">Booking Summary</h2>
              <div className="text-xs text-gray-600 space-y-1">
                <div><span className="font-medium">Field:</span> {fieldId ? fields?.find(f => f.id === fieldId)?.name : '—'}</div>
                <div><span className="font-medium">Date:</span> {date ? formatLocalYMD(date) : '—'}</div>
                <div><span className="font-medium">Start:</span> {startTime || '—'}</div>
                <div><span className="font-medium">End:</span> {endTime || '—'}</div>
                <div><span className="font-medium">Duration:</span> {duration}h</div>
                {(() => {
                  const rate = fieldId ? (fields?.find(f => f.id === fieldId)?.hourly_rate ?? undefined) : undefined;
                  return (
                    <div>
                      <span className="font-medium">Cost{rate ? ` (R${Number(rate).toFixed(0)}/h)` : ''}:</span> {startTime ? `R${Number(cost || 0).toFixed(2)}` : '—'}
                    </div>
                  );
                })()}
              </div>
              <div className="pt-2">
                <Button
                  disabled={disabledSubmit}
                  loading={createMutation.isLoading}
                  onClick={() => createMutation.mutate()}
                  className="w-full"
                >
                  {profileIncomplete
                    ? 'Complete profile to continue'
                    : !startTime || !endTime || cost <= 0
                    ? 'Select a time slot above'
                    : 'Confirm Booking'}
                </Button>
              </div>
              <p className="text-[10px] text-gray-500">Payment can be completed after creation (online or manual).</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateBookingPage;
