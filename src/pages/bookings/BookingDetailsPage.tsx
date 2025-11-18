import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { bookingService } from '../../services/bookingService';
import type { BookingDetails } from '../../types';
import { formatCurrency, formatDate, formatTime } from '../../lib/utils';
import PayButton from '../../components/payments/PayButton';

const BookingDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);

  const { data: booking, isLoading, error } = useQuery<BookingDetails>(
    ['booking', bookingId],
    () => bookingService.getBookingById(bookingId),
    { enabled: Number.isFinite(bookingId) }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6 text-center">
          <p className="text-error-600 mb-4">Failed to load booking details.</p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const showPay = booking.status === 'pending';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back</Button>
          </Link>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Booking #{booking.id}</h1>
              <p className="text-gray-600 mt-1">{booking.field_name}</p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              booking.status === 'confirmed' ? 'bg-success-100 text-success-800' :
              booking.status === 'pending' ? 'bg-warning-100 text-warning-800' :
              booking.status === 'cancelled' ? 'bg-error-100 text-error-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {booking.status.toUpperCase()}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center text-gray-700 mb-2">
                <Calendar className="h-4 w-4 mr-2" />
                <span>{formatDate(booking.booking_date)}</span>
              </div>
              <div className="flex items-center text-gray-700">
                <Clock className="h-4 w-4 mr-2" />
                <span>{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Amount</div>
              <div className="text-2xl font-semibold text-gray-900">{formatCurrency(booking.total_amount)}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            {showPay && (
              <PayButton bookingId={booking.id} label="Pay Now" />
            )}
            {booking.status === 'pending' && (
              <Button variant="error">Cancel Booking</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsPage;
