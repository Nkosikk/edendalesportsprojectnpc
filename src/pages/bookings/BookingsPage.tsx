import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Plus, Filter, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { bookingService } from '../../services/bookingService';
import type { BookingDetails } from '../../types';
import { formatDate, formatTime, formatCurrency } from '../../lib/utils';
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

  // Auto-refresh when user returns from payment tab - more aggressive
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

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  const handleCancelBooking = (bookingId: number) => {
    // Prevent duplicate cancellations (handles React StrictMode double execution)
    if (cancellingRef.current.has(bookingId)) return;
    
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      cancellingRef.current.add(bookingId);
      cancelMutation.mutate({ bookingId, reason: 'Cancelled by user' });
    }
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
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
            <p className="mt-2 text-gray-600">Manage your sports field reservations</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link to="/app/bookings/new">
              <Button icon={Plus} size="lg">
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
            {(visibleBookings || []).map((booking) => (
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
                    {booking.status === 'cancelled' ? (
                      <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">
                        CANCELLED
                      </span>
                    ) : booking.payment_status === 'paid' ? (
                      <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">
                        PAID
                      </span>
                    ) : booking.payment_status === 'pending' && booking.status === 'pending' ? (
                      <span className="px-2 py-1 text-[10px] font-semibold rounded-full bg-yellow-100 text-yellow-700">
                        PAYMENT PENDING
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
                      {formatCurrency(booking.total_amount)}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Link to={`/app/bookings/${booking.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                      <Link to={`/app/bookings/${booking.id}/edit`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          Edit
                        </Button>
                      </Link>
                    )}
                    <Link to={`/app/invoices/${booking.id}`}>
                      <Button variant="outline" size="sm" title="View Invoice">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </Link>
                    {booking.status === 'pending' && booking.payment_status === 'pending' && (
                      <PayButton bookingId={booking.id} label="Pay" />
                    )}
                    {booking.status === 'pending' && (
                      <Button
                        variant="error"
                        size="sm"
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={cancellingRef.current.has(booking.id)}
                      >
                        {cancellingRef.current.has(booking.id) ? 'Cancelling...' : 'Cancel'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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