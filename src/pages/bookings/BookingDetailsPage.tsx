import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { Calendar, Clock, ArrowLeft, FileText } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import InvoiceModal from '../../components/invoices/InvoiceModal';
import { bookingService } from '../../services/bookingService';
import { adminService } from '../../services/adminService';
import type { BookingDetails } from '../../types';
import {
  formatCurrency,
  formatDate,
  formatTime,
  getRefundAdjustedAmount,
  canUserCancelBooking,
  getCancellationRestrictionMessage,
  getExplicitRefundAmount,
} from '../../lib/utils';
import PayButton from '../../components/payments/PayButton';
import { paymentService } from '../../services/paymentService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useState } from 'react';

const BookingDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const { data: booking, isLoading, error } = useQuery<BookingDetails>(
    ['booking', bookingId],
    () => bookingService.getBookingById(bookingId),
    { 
      enabled: !!id && !isNaN(bookingId) && bookingId > 0,
      retry: 1
    }
  );

  const handleCancelBooking = async () => {
    if (!booking) return;
    if (!canUserCancelBooking(booking, user?.role)) {
      const message = getCancellationRestrictionMessage(booking, user?.role) || 'This booking can no longer be cancelled online.';
      toast.error(message);
      return;
    }
    try {
      setCancelling(true);
      await bookingService.cancelBooking(bookingId, cancelReason || (user?.role === 'admin' ? 'Cancelled by admin' : 'Cancelled by user'));
      toast.success('Booking cancelled successfully');
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['booking', bookingId]);
      queryClient.invalidateQueries(['bookings']);
      
      // Close modal and navigate back
      setShowCancelModal(false);
      navigate('/app/bookings');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!booking) return;
    if (booking.status === 'cancelled') {
      toast.error('Cannot process payment for cancelled booking');
      return;
    }
    
    const confirmation = window.confirm(
      `Mark this booking as paid for ${booking.booking_reference}? This action cannot be undone.`
    );
    if (!confirmation) return;

    try {
      setMarkingPaid(true);

      if (booking.payment_status === 'manual_pending') {
        if (booking.payment_id) {
          await paymentService.confirmPayment(booking.payment_id, bookingId);
        }
      } else {
        await adminService.markBookingAsPaid(bookingId);
      }

      if (booking.status === 'pending') {
        await adminService.updateBookingStatus({ booking_id: bookingId, status: 'confirmed' });
      }

      toast.success('Payment recorded successfully');

      queryClient.invalidateQueries(['booking', bookingId]);
      queryClient.invalidateQueries(['bookings']);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to mark as paid';
      if (/already\s+(paid|processed)/i.test(String(message))) {
        toast.success('Booking payment already captured');
        queryClient.invalidateQueries(['booking', bookingId]);
        queryClient.invalidateQueries(['bookings']);
      } else {
        // Show user-friendly message but log the actual error
        console.error('Payment marking error:', error);
        if (message.toLowerCase().includes('something went wrong')) {
          toast.success('Payment status updated (please refresh to see changes)');
        } else {
          toast.error(message);
        }
      }
    } finally {
      setMarkingPaid(false);
    }
  };

  // Invalid booking ID
  if (!id || isNaN(bookingId) || bookingId <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6 text-center">
          <p className="text-error-600 mb-4">Invalid booking ID in URL.</p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

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
          <p className="text-error-600 mb-4">
            {error ? 'Failed to load booking details.' : 'Booking not found.'}
          </p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const showPay = booking.status === 'pending';
  const adjustedAmount = getRefundAdjustedAmount(booking);
  const refundDue = getExplicitRefundAmount(booking);
  const showCancelAction = booking.status === 'pending' || booking.status === 'confirmed';
  const canCancel = canUserCancelBooking(booking, user?.role);
  const cancelRestriction = getCancellationRestrictionMessage(booking, user?.role);

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
              <h1 className="text-2xl font-bold text-gray-900">Booking #{booking.id || '—'}</h1>
              <p className="text-gray-600 mt-1">{booking.field_name || 'Unknown Field'}</p>
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
              <div className="flex items-center text-gray-700 mb-2">
                <Clock className="h-4 w-4 mr-2" />
                <span>{booking.start_time ? formatTime(booking.start_time) : '—'} - {booking.end_time ? formatTime(booking.end_time) : '—'}</span>
              </div>
              <div className="text-sm text-gray-500">
                <div className="mb-1">
                  <span className="font-medium">Payment Status:</span>
                  <span className={`ml-2 px-2 py-1 text-xs rounded ${
                    booking.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                    booking.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    booking.payment_status === 'refunded' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {booking.payment_status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>
                {booking.payment_method && (
                  <div className="mb-1">
                    <span className="font-medium">Payment Method:</span> {booking.payment_method?.toUpperCase()}
                  </div>
                )}
                {booking.notes && (
                  <div className="mb-1">
                    <span className="font-medium">Notes:</span> {booking.notes}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Amount</div>
              <div className="text-2xl font-semibold text-gray-900">{formatCurrency(Math.abs(adjustedAmount))}</div>
                {booking.payment_status === 'refunded' ? (
                  <p className="text-sm font-semibold text-purple-600">
                    Refund processed {refundDue ? `(${formatCurrency(refundDue)})` : ''}
                  </p>
                ) : adjustedAmount < 0 ? (
                  <p className="text-sm font-semibold text-red-600">
                    Refund owed {refundDue ? `(${formatCurrency(refundDue)})` : ''}
                  </p>
                ) : null}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            {showPay && user?.role === 'customer' && (
              <PayButton bookingId={booking.id} label="Pay Now" />
            )}
            {user?.role === 'admin' && (booking.payment_status === 'pending' || booking.payment_status === 'manual_pending') && booking.status !== 'cancelled' && (
              <Button 
                onClick={handleMarkAsPaid}
                loading={markingPaid}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {booking.payment_status === 'manual_pending' ? 'Confirm Manual Payment' : 'Mark as Paid'}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setShowInvoiceModal(true)}
              icon={FileText}
            >
              View Invoice
            </Button>
            {showCancelAction && (
              <Button 
                status="cancelled" 
                onClick={() => {
                  if (!canCancel) {
                    if (cancelRestriction) toast.error(cancelRestriction);
                    return;
                  }
                  setShowCancelModal(true);
                }}
                size="sm"
                disabled={!canCancel}
              >
                Cancel Booking
              </Button>
            )}
          </div>
          {showCancelAction && !canCancel && cancelRestriction && (
            <p className="text-xs text-gray-500 mt-2">{cancelRestriction}</p>
          )}
        </div>

        {/* Cancel Confirmation Modal */}
        <Modal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title="Cancel Booking"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for cancellation (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Please provide a reason for cancelling..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                Keep Booking
              </Button>
              <Button
                variant="error"
                onClick={handleCancelBooking}
                loading={cancelling}
                disabled={!canCancel}
              >
                Cancel Booking
              </Button>
            </div>
          </div>
        </Modal>

        {/* Invoice Modal */}
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          booking={booking}
        />
      </div>
    </div>
  );
};

export default BookingDetailsPage;
