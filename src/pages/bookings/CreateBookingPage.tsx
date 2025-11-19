import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { fieldService } from '../../services/fieldsService';
import { bookingService } from '../../services/bookingService';
import BookingCalendar from '../../components/bookings/BookingCalendar';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { SportsField } from '../../types';
import { useNavigate } from 'react-router-dom';

const CreateBookingPage = () => {
  const [fieldId, setFieldId] = useState<number | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [duration, setDuration] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [cost, setCost] = useState<number>(0);
  const navigate = useNavigate();
  const qc = useQueryClient();

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
      if (!fieldId || !startTime || !endTime) throw new Error('Incomplete booking details');
      return bookingService.createBooking({
        field_id: fieldId,
        booking_date: date.toISOString().split('T')[0],
        start_time: startTime,
        end_time: endTime,
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
        toast.error(message);
      }
    }
  );

  const handleSelectSlot = (start: string, end: string, computedCost: number) => {
    setStartTime(start);
    setEndTime(end);
    setCost(computedCost);
  };

  // Reset any previously selected slot when field/date/duration changes to avoid stale summary
  useEffect(() => {
    setStartTime(null);
    setEndTime(null);
    setCost(0);
  }, [fieldId, date, duration]);

  const disabledSubmit = !fieldId || !startTime || !endTime || createMutation.isLoading;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create Booking</h1>
          <p className="text-gray-600 text-sm mt-1">Select a field, date and time slot to book.</p>
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
                value={date.toISOString().split('T')[0]}
                onChange={e => setDate(new Date(e.target.value + 'T00:00:00'))}
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
            <BookingCalendar
              fieldId={fieldId}
              date={date}
              duration={duration}
              onSelect={handleSelectSlot}
            />
          </div>

          {/* Notes & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={5}
                className="input text-sm resize-none"
                placeholder="Any special requirements or comments"
              />
            </div>
            <div className="bg-white p-4 rounded-lg border space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">Booking Summary</h2>
              <div className="text-xs text-gray-600 space-y-1">
                <div><span className="font-medium">Field:</span> {fieldId ? fields?.find(f => f.id === fieldId)?.name : '—'}</div>
                <div><span className="font-medium">Date:</span> {date.toISOString().split('T')[0]}</div>
                <div><span className="font-medium">Start:</span> {startTime || '—'}</div>
                <div><span className="font-medium">End:</span> {endTime || '—'}</div>
                <div><span className="font-medium">Duration:</span> {duration}h</div>
                {(() => {
                  const rate = fieldId ? (fields?.find(f => f.id === fieldId)?.hourly_rate ?? undefined) : undefined;
                  return (
                    <div>
                      <span className="font-medium">Cost{rate ? ` (R${Number(rate).toFixed(0)}/h)` : ''}:</span> {startTime ? `R${cost.toFixed(2)}` : '—'}
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
                  Confirm Booking
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
