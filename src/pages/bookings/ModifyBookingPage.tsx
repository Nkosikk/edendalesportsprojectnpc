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

const ModifyBookingPage = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
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
        setDate(new Date(booking.booking_date + 'T00:00:00'));
        setNotes(booking.notes || '');
        
        // Calculate original duration and set initial values
        if (booking.start_time && booking.end_time) {
          const startHour = parseInt(booking.start_time.split(':')[0]);
          const endHour = parseInt(booking.end_time.split(':')[0]);
          const originalDuration = endHour - startHour;
          setDuration(originalDuration > 0 ? originalDuration : booking.duration_hours || 1);
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
      const dateChanged = date.toISOString().split('T')[0] !== booking.booking_date;
      const timeChanged = startTime !== booking.start_time || endTime !== booking.end_time;
      const notesChanged = notes !== (booking.notes || '');
      setHasChanges(dateChanged || timeChanged || notesChanged);
    }
  }, [booking, date, startTime, endTime, notes]);

  const updateMutation = useMutation(
    async () => {
      if (!startTime || !endTime) throw new Error('Please select a new time slot');
      if (!hasChanges) throw new Error('No changes to save');
      
      return bookingService.updateBooking(bookingId, {
        booking_date: date.toISOString().split('T')[0],
        start_time: startTime,
        end_time: endTime,
        notes: notes || undefined,
      });
    },
    {
      onSuccess: () => {
        toast.success('Booking updated successfully');
        qc.invalidateQueries(['bookings']);
        qc.invalidateQueries(['booking', bookingId]);
        navigate('/app/bookings');
      },
      onError: (e: any) => {
        toast.error(e?.response?.data?.message || e.message || 'Update failed');
      }
    }
  );

  const handleSelect = (start: string, end: string, c: number) => {
    setStart(start); setEnd(end); setCost(c);
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

  if (!canEdit) {
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
            <input type="date" value={date.toISOString().split('T')[0]} onChange={e => setDate(new Date(e.target.value + 'T00:00:00'))} className="input text-sm" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Duration</label>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="input text-sm">
              {[1,2,3,4].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
          <div className="flex items-end"><Button variant="outline" size="sm" onClick={() => { setDate(new Date()); setDuration(1); setStart(null); setEnd(null); }}>Reset</Button></div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          {booking.field_id ? (
            <BookingCalendar 
              fieldId={booking.field_id} 
              date={date} 
              duration={duration} 
              onSelect={handleSelect}
              currentBooking={{
                start_time: booking.start_time,
                end_time: booking.end_time,
                date: booking.booking_date
              }}
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
                <div><span className="font-medium">Date:</span> {date.toISOString().split('T')[0]}</div>
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
