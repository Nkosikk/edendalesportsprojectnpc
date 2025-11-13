import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Plus, Filter } from 'lucide-react';
import { useQuery } from 'react-query';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { bookingService } from '../../services/bookingService';
import { formatDate, formatTime, formatCurrency } from '../../lib/utils';

const BookingsPage = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data: bookingsData, isLoading, error } = useQuery(
    ['bookings', statusFilter],
    () => bookingService.getMyBookings({
      status: statusFilter === 'all' ? undefined : statusFilter
    }),
    {
      retry: 1,
    }
  );

  const bookings = bookingsData?.content || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-success-100 text-success-800';
      case 'PENDING':
        return 'bg-warning-100 text-warning-800';
      case 'CANCELLED':
        return 'bg-error-100 text-error-800';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
            {['all', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
              >
                {status === 'all' ? 'All' : status}
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
        ) : bookings.length === 0 ? (
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
            {bookings.map((booking) => (
              <div key={booking.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {booking.field?.name || 'Field Name'}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin className="h-4 w-4 mr-1" />
                      {booking.field?.location || 'Location'}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                    {booking.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {formatDate(booking.startDateTime)}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    {formatTime(booking.startDateTime)} - {formatTime(booking.endDateTime)}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Total Amount</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatCurrency(booking.totalAmount)}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Link to={`/app/bookings/${booking.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    {booking.status === 'PENDING' && (
                      <Button
                        variant="error"
                        size="sm"
                        onClick={() => {
                          // Handle cancel booking
                          console.log('Cancel booking', booking.id);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {bookingsData && bookingsData.totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <span className="px-3 py-2 text-sm text-gray-600">
                Page 1 of {bookingsData.totalPages}
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