import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Plus, Filter, FileText, Banknote, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { bookingService } from '../../services/bookingService';
// paymentService unused; removed import to satisfy TS
import type { BookingDetails } from '../../types';
import {
  formatDate,
  formatTime,
  formatCurrency,
  getRefundAdjustedAmount,
  canUserCancelBooking,
  getCancellationRestrictionMessage,
  getExplicitRefundAmount,
} from '../../lib/utils';
import PayButton from '../../components/payments/PayButton';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const BookingsPage = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cancellingRef = useRef<Set<number>>(new Set());
  const pollingRef = useRef<number | null>(null);


  const { data: bookings, isLoading, error, refetch } = useQuery<BookingDetails[]>(
    ['bookings', user?.id || 'anon', statusFilter],
    () => {
      const filters = statusFilter === 'all' ? {} : { status: statusFilter.toLowerCase() as any };
      return bookingService.getBookings(filters);
    },
    { 
      retry: 1, 
      enabled: !!user,
      staleTime: 0,  // Always treat as stale so manual refetch works immediately
      cacheTime: 1 * 60 * 1000,  // Keep in cache for 1 minute for fast re-mounting
    }
  );

  // Auto-refresh when user returns from payment tab - more aggressive + mobile support
  useEffect(() => {
    const handleFocus = () => {
      // Force immediate fresh fetch from server when returning to tab
      if (user) {
        queryClient.invalidateQueries(['bookings']);
        refetch();
      }
    };

    const handleVisibilityChange = () => {
      // Also refresh when page becomes visible again
      if (!document.hidden && user) {
        queryClient.invalidateQueries(['bookings']);
        refetch();
      }
    };

    // Mobile-specific refresh triggers
    const handleTouchEnd = () => {
      if (user && 'ontouchstart' in window) {
        // Only refresh if user pulled down (simple heuristic)
        if (window.scrollY === 0) {
          queryClient.invalidateQueries(['bookings']);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [user, refetch, queryClient]);

  const cancelMutation = useMutation(
    ({ bookingId, reason }: { bookingId: number; reason?: string }) =>
      bookingService.cancelBooking(bookingId, reason),
    {
      onSuccess: (_data, variables) => {
        // mark parameter as used to satisfy TS noUnusedParameters
        void _data;
        cancellingRef.current.delete(variables.bookingId);
        toast.success('Booking cancelled successfully', { id: `cancel-success-${variables.bookingId}` });
        queryClient.invalidateQueries(['bookings']);
      },
      onError: (error: any, variables) => {
        cancellingRef.current.delete(variables.bookingId);
        // Only show if interceptor did not already display error toast
        if (!(error as any)?._toastShown) {
          toast.error(error?.response?.data?.message || error.message || 'Failed to cancel booking', {
            id: `cancel-error-${variables.bookingId}`,
          });
        }
      },
    }
  );

  const [showPaymentInstructions, setShowPaymentInstructions] = useState<number | null>(null);

  const handleCancelBooking = (booking: BookingDetails) => {
    // Prevent duplicate cancellations (handles React StrictMode double execution)
    if (cancellingRef.current.has(booking.id)) return;
    const canCancel = canUserCancelBooking(booking, user?.role);
    if (!canCancel) {
      const message = getCancellationRestrictionMessage(booking, user?.role) || 'This booking can no longer be cancelled online.';
      toast.error(message);
      return;
    }

    if (window.confirm('Are you sure you want to cancel this booking?')) {
      cancellingRef.current.add(booking.id);
      cancelMutation.mutate({
        bookingId: booking.id,
        reason: user?.role === 'admin' ? 'Cancelled by admin' : 'Cancelled by user',
      });
    }
  };

  const handleManualPayment = (bookingId: number) => {
    setShowPaymentInstructions(bookingId);
  };  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-success-100 text-success-800';
      case 'pending':
        return 'bg-warning-100 text-warning-800';
      case 'cancelled':
        return 'bg-error-100 text-error-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Only show admin's own bookings when user is an admin
  const visibleBookings = useMemo(() => {
    if (!bookings) return [] as BookingDetails[];
    if (user?.role === 'admin') {
      // Be tolerant of API type differences (string vs number IDs)
      const myId = Number(user.id);
      return bookings.filter((b) => Number(b.user_id) === myId);
    }
    return bookings;
  }, [bookings, user]);

  // Simple periodic refresh for pending payments - aggressive polling while paying
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    const hasPendingPayments = (visibleBookings || [])
      .some(b => b.status === 'pending' && b.payment_status === 'pending');
    
    if (!hasPendingPayments) return;

    // Aggressive polling: check every 2 seconds while there are pending payments
    pollingRef.current = window.setInterval(() => {
      queryClient.invalidateQueries(['bookings']);
      refetch({ throwOnError: false });
    }, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [visibleBookings, refetch, queryClient]);



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Bookings</h1>
            <p className="mt-2 text-gray-600">Manage your sports field reservations</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="lg"
              icon={RefreshCw}
              onClick={() => {
                toast.dismiss();
                toast.loading('Refreshing bookings...', { id: 'refresh-bookings' });
                queryClient.invalidateQueries(['bookings']);
                refetch({ throwOnError: false }).then(() => {
                  toast.success('Bookings updated', { id: 'refresh-bookings' });
                }).catch(() => {
                  toast.error('Failed to refresh', { id: 'refresh-bookings' });
                });
              }}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Refresh
            </Button>
            <Link to="/app/bookings/new" className="w-full sm:w-auto">
              <Button icon={Plus} size="lg" className="w-full">
                New Booking
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Bookings Grid */}
        {error ? (
          <div className="text-center py-12">
            <div className="bg-error-50 border border-error-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-error-600">Failed to load bookings. Please try again later.</p>
            </div>
          </div>
        ) : (visibleBookings?.length || 0) === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-500 mb-6">
              {statusFilter === 'all' 
                ? "You haven't made any bookings yet." 
                : `No ${statusFilter.toLowerCase()} bookings found.`}
            </p>
            <Link to="/app/bookings/new">
              <Button icon={Plus}>Make Your First Booking</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(visibleBookings || []).map((booking) => {
              const adjustedAmount = getRefundAdjustedAmount(booking);
              const refundDue = getExplicitRefundAmount(booking);
              const showCancelAction = booking.status === 'pending' || booking.status === 'confirmed';
              const canCancel = canUserCancelBooking(booking, user?.role);
              const cancelRestriction = getCancellationRestrictionMessage(booking, user?.role);
              return (
                <div key={booking.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {booking.field_name}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                      {booking.status.toUpperCase()}
                    </span>
                    {booking.payment_status === 'refunded' ? (
                      <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700">
                        REFUNDED
                      </span>
                    ) : booking.payment_status === 'paid' ? (
                      <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                        PAID
                      </span>
                    ) : booking.payment_status === 'pending' && booking.status === 'pending' ? (
                      <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-yellow-100 text-yellow-700">
                        PAYMENT PENDING
                      </span>
                    ) : booking.payment_status === 'manual_pending' ? (
                      <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">
                        MANUAL PAYMENT
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {formatDate(booking.booking_date)}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                  </div>
                  {booking.notes && (
                    <div className="text-sm text-gray-600">
                      <span className="text-gray-500">📝 Notes:</span> {booking.notes.length > 50 ? booking.notes.substring(0, 50) + '...' : booking.notes}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Total Amount</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatCurrency(Math.abs(adjustedAmount))}
                    </span>
                  </div>
                  {booking.payment_status === 'refunded' ? (
                    <p className="text-xs font-semibold text-purple-600">Refund processed{refundDue ? ` (${formatCurrency(refundDue)})` : ''}</p>
                  ) : adjustedAmount < 0 ? (
                    <p className="text-xs font-semibold text-red-600">Refund owed to you{refundDue ? `: ${formatCurrency(refundDue)}` : ''}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/app/bookings/${booking.id}`} className="flex-1 min-w-[100px]">
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                      <Link to={`/app/bookings/${booking.id}/edit`} className="flex-1 min-w-[80px]">
                        <Button variant="outline" size="sm" className="w-full">
                          Edit
                        </Button>
                      </Link>
                    )}
                    <Link to={`/app/invoices/${booking.id}`} title="View Invoice">
                      <Button status="info" size="sm" icon={FileText}>
                        Invoice
                      </Button>
                    </Link>
                    {booking.status === 'pending' && booking.payment_status === 'pending' && (
                      <>
                        <PayButton bookingId={booking.id} label="Pay Online" />
                        <Button
                          status="pending"
                          size="sm"
                          onClick={() => handleManualPayment(booking.id)}
                          icon={Banknote}
                        >
                          Manual Pay
                        </Button>
                      </>
                    )}
                    {booking.status === 'pending' && booking.payment_status === 'manual_pending' && (
                      <span className="text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded whitespace-nowrap">
                        Awaiting proof of payment
                      </span>
                    )}
                    {showCancelAction && (
                      <div className="flex-1 min-w-[120px]" title={!canCancel && cancelRestriction ? cancelRestriction : undefined}>
                        <Button
                          status="cancelled"
                          size="sm"
                          onClick={() => handleCancelBooking(booking)}
                          disabled={cancellingRef.current.has(booking.id) || !canCancel}
                        >
                          {cancellingRef.current.has(booking.id) ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      </div>
                    )}
                  </div>
                  {showCancelAction && !canCancel && cancelRestriction && (
                    <p className="text-[11px] text-gray-500 mt-2">{cancelRestriction}</p>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}

        {/* Payment Instructions Modal */}
        {showPaymentInstructions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Manual Payment Instructions</h3>
                <button
                  onClick={() => setShowPaymentInstructions(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Banking Details</h4>
                  <div className="space-y-1 text-blue-800">
                    <p><strong>Bank:</strong> Capitec</p>
                    <p><strong>Branch Code:</strong> 470010</p>
                    <p><strong>Account Name:</strong> Edendale Sports Projects NPC</p>
                    <p><strong>Account Number:</strong> 1234567890</p>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Payment Reference</h4>
                  <p className="text-yellow-800">
                    <strong>Use your name as reference:</strong> {user?.first_name} {user?.last_name}
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Proof of Payment</h4>
                  <p className="text-green-800">
                    Send proof of payment to: <strong>edendale@gmail.com</strong>
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Important Notes</h4>
                  <ul className="text-gray-700 text-xs space-y-1 list-disc list-inside">
                    <li>Your booking will remain pending until payment is confirmed</li>
                    <li>Include your booking reference in the email</li>
                    <li>Payment confirmation may take 1-2 business days</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowPaymentInstructions(null)}>
                  Got it
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {/* In current API, bookings list is not paginated */}
        {false && (
          <div className="mt-8 flex justify-center">
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <span className="px-3 py-2 text-sm text-gray-600">
                Page 1 of 1
              </span>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingsPage;