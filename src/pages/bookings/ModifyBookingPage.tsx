import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { bookingService } from '../../services/bookingService';
import BookingCalendar from '../../components/bookings/BookingCalendar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { BookingDetails } from '../../types';
import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { safeNumber } from '../../lib/utils';
import { normalizeTimeHM } from '../../utils/scheduling';

const parseDateFromISO = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const toLocalDateInputValue = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const ModifyBookingPage = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(startOfToday());
  const [duration, setDuration] = useState<number>(1);
  const [startTime, setStart] = useState<string | null>(null);
  const [endTime, setEnd] = useState<string | null>(null);
  const [cost, setCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const { data: booking, isLoading: loadingBooking, error: bookingError } = useQuery<BookingDetails>(
    ['booking', bookingId], 
    () => bookingService.getBookingById(bookingId), 
    { 
      enabled: !!id && !isNaN(bookingId) && bookingId > 0,
      retry: 1
    }
  );

  // Initialize form with existing booking data
  useEffect(() => {
    if (booking) {
      try {
        setDate(parseDateFromISO(booking.booking_date));
        setNotes(booking.notes || '');
        
        // Set initial time values from booking
        if (booking.start_time && booking.end_time) {
          const normalizedStart = normalizeTimeHM(booking.start_time);
          const normalizedEnd = normalizeTimeHM(booking.end_time);
          setStart(normalizedStart || booking.start_time);
          setEnd(normalizedEnd || booking.end_time);
          const startHour = parseInt((normalizedStart || booking.start_time).split(':')[0]);
          const endHour = parseInt((normalizedEnd || booking.end_time).split(':')[0]);
          const originalDuration = endHour - startHour;
          setDuration(originalDuration > 0 ? originalDuration : booking.duration_hours || 1);
          
          // Calculate initial cost
          const fieldHourlyRate = 400; // Default rate, will be synced when calendar loads
          const hours = originalDuration > 0 ? originalDuration : booking.duration_hours || 1;
          setCost(fieldHourlyRate * hours);
        } else {
          setDuration(booking.duration_hours || 1);
        }
      } catch (error) {
        console.error('Error initializing booking data:', error);
        setDuration(1);
      }
    }
  }, [booking]);

  // Track changes
  useEffect(() => {
    if (booking) {
      const dateChanged = toLocalDateInputValue(date) !== booking.booking_date;
      const normalizedStart = normalizeTimeHM(booking.start_time);
      const normalizedEnd = normalizeTimeHM(booking.end_time);
      const timeChanged = normalizeTimeHM(startTime) !== normalizedStart || normalizeTimeHM(endTime) !== normalizedEnd;
      const notesChanged = notes !== (booking.notes || '');
      setHasChanges(dateChanged || timeChanged || notesChanged);
    }
  }, [booking, date, startTime, endTime, notes]);

  const updateMutation = useMutation(
    async () => {
      if (!startTime || !endTime) throw new Error('Please select a new time slot');
      if (!hasChanges) throw new Error('No changes to save');
      if (!booking) throw new Error('Booking not loaded yet');

      const normalizedStart = normalizeTimeHM(startTime) || startTime;
      const normalizedEnd = normalizeTimeHM(endTime) || endTime;

      const newBooking = await bookingService.createBooking({
        field_id: booking.field_id,
        booking_date: toLocalDateInputValue(date),
        start_time: normalizedStart,
        end_time: normalizedEnd,
        duration_hours: duration,
        notes: notes || undefined,
      });

      let cancelFailed = false;
      let cancelErrorMessage: string | undefined;
      if (booking.status !== 'cancelled') {
        try {
          const reason = `Rescheduled via edit${newBooking?.booking_reference ? ` (#${newBooking.booking_reference})` : ''}`;
          await bookingService.cancelBooking(bookingId, reason);
        } catch (error: any) {
          console.error('Failed to cancel original booking after reschedule', error);
          cancelFailed = true;
          cancelErrorMessage = error?.response?.data?.message || error?.message;
        }
      }

      return { newBooking, cancelFailed, cancelErrorMessage };
    },
    {
      onSuccess: ({ newBooking, cancelFailed, cancelErrorMessage }) => {
        if (cancelFailed) {
          toast.success('New booking created, but please cancel the original booking manually.');
          if (cancelErrorMessage) {
            toast.error(cancelErrorMessage);
          }
        } else {
          toast.success('New booking created and original booking archived as cancelled.');
        }
        qc.invalidateQueries(['bookings']);
        qc.invalidateQueries(['booking', bookingId]);
        if (newBooking?.id) {
          qc.invalidateQueries(['booking', newBooking.id]);
        }
        navigate('/app/bookings');
      },
      onError: (e: any) => {
        toast.error(e?.response?.data?.message || e.message || 'Update failed');
      }
    }
  );

  const handleSelect = (start: string, end: string, c: number) => {
    const normalizedStart = normalizeTimeHM(start) || start;
    const normalizedEnd = normalizeTimeHM(end) || end;
    setStart(normalizedStart);
    setEnd(normalizedEnd);
    setCost(c);
  };

  // Invalid booking ID
  if (!id || isNaN(bookingId) || bookingId <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Booking ID</h2>
          <p className="text-gray-600 mb-4">The booking ID in the URL is invalid.</p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loadingBooking) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (bookingError || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking Not Found</h2>
          <p className="text-gray-600 mb-4">
            {bookingError ? 'Failed to load booking details.' : 'The booking you\'re trying to edit doesn\'t exist.'}
          </p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if user can edit this booking
  const canEdit = booking.status === 'pending' || booking.status === 'confirmed';
  const isOwner = user?.role === 'admin' || booking.user_id === user?.id;

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to edit this booking.</p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if booking is in the past
  const isPastBooking = (() => {
    try {
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
      return bookingDateTime < new Date();
    } catch {
      return false;
    }
  })();

  if (!canEdit && booking.status !== 'cancelled') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cannot Edit Booking</h2>
          <p className="text-gray-600 mb-4">This booking cannot be edited because it has been {booking.status}.</p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isPastBooking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cannot Edit Past Booking</h2>
          <p className="text-gray-600 mb-4">This booking cannot be edited because it has already occurred.</p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <Link to="/app/bookings">
                <Button variant="outline" size="sm" icon={ArrowLeft}>Back</Button>
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Edit Booking</h1>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {booking.field_name || 'Unknown Field'} • Original: {booking.booking_date || '—'} {booking.start_time || '—'}-{booking.end_time || '—'}
            </p>
            {hasChanges && (
              <p className="text-xs text-amber-600 mt-1">⚠️ You have unsaved changes</p>
            )}
          </div>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            booking.status === 'confirmed' ? 'bg-success-100 text-success-800' :
            booking.status === 'pending' ? 'bg-warning-100 text-warning-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {booking.status.toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg border">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={toLocalDateInputValue(date)}
              onChange={e => {
                if (e.target.value) {
                  setDate(parseDateFromISO(e.target.value));
                }
              }}
              className="input text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Duration</label>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="input text-sm">
              {[1,2,3,4].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDate(startOfToday());
                setDuration(1);
                setStart(null);
                setEnd(null);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          {booking.field_id ? (
            <BookingCalendar 
              fieldId={booking.field_id} 
              date={date} 
              duration={duration}
              initialStartTime={startTime || booking.start_time}
              onSelect={handleSelect}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              Field information unavailable (Field ID: {booking.field_id || 'missing'})
            </div>
          )}
        </div>
        {/* Notes Section */}
        <div className="bg-white p-4 rounded-lg border">
          <label className="block text-sm font-medium text-gray-700 mb-2">Booking Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full"
            rows={3}
            placeholder="Any special requirements or comments..."
          />
        </div>

        {/* Summary Section */}
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Booking Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">CURRENT BOOKING</h3>
              <div className="text-sm space-y-1 text-gray-700">
                <div><span className="font-medium">Field:</span> {booking.field_name || 'Unknown Field'}</div>
                <div><span className="font-medium">Date:</span> {booking.booking_date || '—'}</div>
                <div><span className="font-medium">Time:</span> {booking.start_time || '—'} - {booking.end_time || '—'}</div>
                <div><span className="font-medium">Amount:</span> R{safeNumber(booking.total_amount).toFixed(2)}</div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">NEW BOOKING</h3>
              <div className="text-sm space-y-1 text-gray-700">
                <div><span className="font-medium">Field:</span> {booking.field_name}</div>
                <div><span className="font-medium">Date:</span> {toLocalDateInputValue(date)}</div>
                <div><span className="font-medium">Time:</span> {startTime || '—'} {endTime ? `- ${endTime}` : ''}</div>
                <div><span className="font-medium">Duration:</span> {duration}h</div>
                <div><span className="font-medium">Estimated Cost:</span> {startTime ? `R${safeNumber(cost).toFixed(2)}` : '—'}</div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/app/bookings')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              disabled={!hasChanges || !startTime || updateMutation.isLoading}
              loading={updateMutation.isLoading}
              onClick={() => updateMutation.mutate()}
              className="flex-1"
            >
              {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModifyBookingPage;
