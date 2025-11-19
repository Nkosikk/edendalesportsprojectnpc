import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { bookingService } from '../../services/bookingService';
import type { BookingDetails } from '../../types';
import { formatCurrency, formatDate, formatTime } from '../../lib/utils';

const DashboardPage = () => {
  // Month window in local time (inclusive)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const { data: bookings = [], isLoading } = useQuery<BookingDetails[]>(
    ['dashboard-bookings', fmt(monthStart), fmt(monthEnd)],
    () =>
      bookingService.getBookings({
        from_date: fmt(monthStart),
        to_date: fmt(monthEnd),
      }),
    { staleTime: 60_000, retry: 1 }
  );

  const stats = useMemo(() => {
    const todayStr = fmt(new Date());
    const toDate = (s: string) => new Date(s + 'T00:00:00');
    // no-op; keep calculations minimal

    const active = bookings.filter((b) => {
      // Treat confirmed bookings today or in the future as active
      return b.status === 'confirmed' && toDate(b.booking_date).getTime() >= toDate(todayStr).getTime();
    }).length;

    const completed = bookings.filter((b) => b.status === 'completed').length;

    const pending = bookings.filter((b) => b.status === 'pending').length;

    // Total Spent = sum of amounts for confirmed bookings in the month
    const totalSpent = bookings
      .filter((b) => b.status === 'confirmed')
      .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

    const recent = [...bookings]
      .sort((a, b) => new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime())
      .slice(0, 5);

    return { active, completed, pending, totalSpent, recent };
  }, [bookings]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Welcome to your sports booking dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <span className="text-primary-600 font-semibold">{isLoading ? '—' : stats.active}</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Active Bookings</h3>
                <p className="text-sm text-gray-500">Currently active</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <span className="text-success-600 font-semibold">{isLoading ? '—' : stats.completed}</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Completed</h3>
                <p className="text-sm text-gray-500">This month</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <span className="text-warning-600 font-semibold">{isLoading ? '—' : stats.pending}</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Pending</h3>
                <p className="text-sm text-gray-500">Awaiting confirmation</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 bg-gray-100 rounded-lg flex items-center justify-center px-3 min-w-[96px]">
                  <span className="text-gray-600 font-semibold truncate">
                    {isLoading ? '—' : formatCurrency(stats.totalSpent)}
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Total Spent</h3>
                <p className="text-sm text-gray-500">This month</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Bookings</h2>
          </div>
          <div className="p-6">
            {isLoading ? (
              <p className="text-gray-500 text-center py-8">Loading…</p>
            ) : stats.recent.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Your recent bookings will appear here.
                <a href="/app/bookings/new" className="text-primary-600 hover:text-primary-700 ml-1">
                  Create your first booking
                </a>
              </p>
            ) : (
              <div className="divide-y">
                {stats.recent.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{b.field_name}</div>
                      <div className="text-gray-500">{formatDate(b.booking_date)} · {formatTime(b.start_time)} - {formatTime(b.end_time)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">{formatCurrency(b.total_amount)}</div>
                      <div className="text-xs text-gray-500">{b.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;