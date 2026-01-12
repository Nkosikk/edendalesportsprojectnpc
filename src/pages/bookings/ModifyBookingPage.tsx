import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { bookingService } from '../../services/bookingService';
import { paymentService } from '../../services/paymentService';
import { adminService } from '../../services/adminService';
import BookingCalendar from '../../components/bookings/BookingCalendar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { BookingDetails } from '../../types';
import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { safeNumber, canUserModifyBooking, getModificationRestrictionMessage } from '../../lib/utils';
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

      // Calculate original and new duration (ensure integer comparison)
      const originalDuration = Math.round(safeNumber(booking.duration_hours) || 1);
      const newDuration = Math.round(duration);
      const hourlyRate = safeNumber(booking.hourly_rate) || 400;
      
      // Calculate amounts
      const originalAmount = safeNumber(booking.total_amount);
      const newAmount = newDuration * hourlyRate;
      const amountPaid = booking.payment_status === 'paid' ? originalAmount : 0;
      
      // Payment adjustment: positive = user owes more, negative = refund/credit due
      const paymentAdjustment = newAmount - amountPaid;
      
      // Determine if original booking was paid
      const wasOriginalPaid = booking.payment_status === 'paid';
      
      // Build the create booking request with payment carryover info
      const createRequest: any = {
        field_id: booking.field_id,
        booking_date: toLocalDateInputValue(date),
        start_time: normalizedStart,
        end_time: normalizedEnd,
        duration_hours: newDuration,
        notes: notes || undefined,
      };
      
      // Add payment carryover fields if original was paid
      if (wasOriginalPaid) {
        createRequest.original_booking_id = booking.id;
        createRequest.original_booking_reference = booking.booking_reference;
        createRequest.original_total_amount = originalAmount;
        createRequest.original_payment_status = booking.payment_status;
        createRequest.original_duration_hours = originalDuration;
        createRequest.carry_over_payment = true;
        createRequest.amount_paid = amountPaid;
        createRequest.payment_adjustment = paymentAdjustment;
      }

      const newBooking = await bookingService.createBooking(createRequest);

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

      // Handle payment status for the new booking based on duration change
      let paymentConfirmed = false;
      let paymentMessage = '';
      
      if (wasOriginalPaid && newBooking?.id) {
        try {
          if (newDuration === originalDuration || newDuration < originalDuration) {
            // Same or shorter duration: Mark as paid and confirm
            // First try to mark as paid (creates payment record)
            try {
              await adminService.markBookingAsPaid(newBooking.id);
            } catch (markPaidErr: any) {
              console.warn('markBookingAsPaid failed, trying confirmPayment:', markPaidErr);
              // Fallback to confirmPayment if markBookingAsPaid fails
              await paymentService.confirmPayment(undefined, newBooking.id);
            }
            
            // Then update status to confirmed
            try {
              await adminService.updateBookingStatus({ 
                booking_id: newBooking.id, 
                status: 'confirmed' 
              });
            } catch (statusErr: any) {
              console.warn('updateBookingStatus failed:', statusErr);
            }
            
            paymentConfirmed = true;
            if (newDuration === originalDuration) {
              paymentMessage = 'Payment transferred from original booking.';
            } else {
              const refundAmount = amountPaid - newAmount;
              paymentMessage = `Payment confirmed. Credit of R${refundAmount.toFixed(2)} is due to you.`;
            }
          } else {
            // Longer duration: Still pending, but partial payment applied
            const pendingAmount = newAmount - amountPaid;
            paymentMessage = `Partial payment of R${amountPaid.toFixed(2)} applied. Remaining balance: R${pendingAmount.toFixed(2)}.`;
          }
        } catch (paymentError: any) {
          console.warn('Failed to update payment status for new booking:', paymentError);
          paymentMessage = 'Note: Please verify payment status manually.';
        }
      }

      return { 
        newBooking, 
        cancelFailed, 
        cancelErrorMessage, 
        paymentConfirmed, 
        paymentMessage,
        wasOriginalPaid
      };
    },
    {
      onSuccess: ({ newBooking, cancelFailed, cancelErrorMessage, paymentConfirmed, paymentMessage, wasOriginalPaid }) => {
        if (cancelFailed) {
          toast.success('New booking created, but please cancel the original booking manually.');
          if (cancelErrorMessage) {
            toast.error(cancelErrorMessage);
          }
        } else {
          toast.success('New booking created and original booking archived as cancelled.');
        }
        
        // Show payment status message
        if (wasOriginalPaid && paymentMessage) {
          if (paymentConfirmed) {
            toast.success(paymentMessage);
          } else {
            toast(paymentMessage, { duration: 5000, icon: 'ℹ️' });
          }
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

  // Check if user can edit this booking (3 hours before start time)
  const canEdit = canUserModifyBooking(booking, user?.role);
  const modificationRestriction = getModificationRestrictionMessage(booking, user?.role);
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

  if (!canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cannot Edit Booking</h2>
          <p className="text-gray-600 mb-4">
            {modificationRestriction || 'This booking cannot be edited.'}
          </p>
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
                <div><span className="font-medium">Duration:</span> {booking.duration_hours || 1}h</div>
                <div><span className="font-medium">Amount:</span> R{safeNumber(booking.total_amount).toFixed(2)}</div>
                <div>
                  <span className="font-medium">Payment:</span>{' '}
                  <span className={`${booking.payment_status === 'paid' ? 'text-green-600 font-semibold' : 'text-amber-600'}`}>
                    {booking.payment_status === 'paid' ? '✓ PAID' : 'PENDING'}
                  </span>
                </div>
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
          
          {/* Payment Carryover Information */}
          {booking.payment_status === 'paid' && startTime && (
            <div className="mt-4 p-3 rounded-lg border-2 border-dashed bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-2">💳 Payment Adjustment</h3>
              {(() => {
                const originalDuration = Math.round(safeNumber(booking.duration_hours) || 1);
                const newDuration = Math.round(duration);
                const originalAmount = safeNumber(booking.total_amount);
                const newAmount = safeNumber(cost);
                
                if (newDuration === originalDuration) {
                  return (
                    <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
                      <span className="font-medium">✓ Same duration:</span> Your payment of R{originalAmount.toFixed(2)} will be transferred to the new booking. Status will be <span className="font-semibold">PAID & CONFIRMED</span>.
                    </div>
                  );
                } else if (newDuration < originalDuration) {
                  const credit = originalAmount - newAmount;
                  return (
                    <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                      <span className="font-medium">↓ Shorter duration:</span> Credit of <span className="font-semibold">R{credit.toFixed(2)}</span> will be due to you. New booking will be <span className="font-semibold">PAID & CONFIRMED</span>.
                    </div>
                  );
                } else {
                  const pending = newAmount - originalAmount;
                  return (
                    <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
                      <span className="font-medium">↑ Longer duration:</span> Your payment of R{originalAmount.toFixed(2)} will be applied. Additional <span className="font-semibold">R{pending.toFixed(2)}</span> pending payment required.
                    </div>
                  );
                }
              })()}
            </div>
          )}
          
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
