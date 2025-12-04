import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BookingOverview, { type BookingOverviewMetrics } from '../../components/admin/BookingOverview';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { adminService } from '../../services/adminService';
import type { DashboardData, BookingDetails, AdminBookingFilters } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dateRange, setDateRange] = useState({
    from: '',
    to: '',
  });

  const metricNavigation: Partial<Record<keyof BookingOverviewMetrics, { path: string; state?: { filters?: Partial<AdminBookingFilters> } }>> = {
    total_revenue: { path: '/admin/reports/revenue' },
    total_bookings: { path: '/admin/bookings', state: { filters: { status: undefined, payment_status: undefined, field_id: undefined } } },
    confirmed_bookings: { path: '/admin/bookings', state: { filters: { status: 'confirmed', payment_status: undefined } } },
    pending_payments: { path: '/admin/bookings', state: { filters: { payment_status: 'pending', status: undefined } } },
    total_hours: { path: '/admin/reports/analytics' },
    total_users: { path: '/admin/users' },
  };

  const handleMetricClick = (metric: keyof BookingOverviewMetrics) => {
    const destination = metricNavigation[metric];
    if (!destination) return;
    if (destination.state) {
      navigate(destination.path, { state: destination.state });
    } else {
      navigate(destination.path);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [dateRange]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const fromParam = dateRange.from || undefined;
      const toParam = dateRange.to || undefined;
      const data = await adminService.getDashboard(fromParam, toParam);
      setDashboard(data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-500">No dashboard data available</p>
      </div>
    );
  }

  const overviewMetrics = {
    total_revenue: dashboard.summary.total_revenue,
    total_bookings: dashboard.summary.total_bookings,
    confirmed_bookings: dashboard.summary.confirmed_bookings,
    pending_payments: dashboard.summary.pending_payments,
    total_hours: dashboard.summary.total_hours,
    total_users: dashboard.summary.total_users,
  };

  const bookingColumns = [
    {
      key: 'booking_reference',
      title: 'Reference',
      className: 'w-[18%]',
      render: (value: string) => (
        <span className="font-mono text-xs truncate block">{value}</span>
      ),
    },
    {
      key: 'first_name',
      title: 'Customer',
      className: 'w-[22%]',
      render: (_: any, row: BookingDetails) => (
        <div className="min-w-0">
          <div className="font-medium text-xs truncate">{`${row.first_name} ${row.last_name}`}</div>
          <div className="text-xs text-gray-500 truncate">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'field_name',
      title: 'Field',
      className: 'w-[10%]',
      render: (value: string) => (
        <span className="text-xs truncate block">{value}</span>
      ),
    },
    {
      key: 'booking_date',
      title: 'Date & Time',
      className: 'w-[18%]',
      render: (_: any, row: BookingDetails) => (
        <div className="min-w-0">
          <div className="text-xs">{format(new Date(row.booking_date), 'MMM dd, yyyy')}</div>
          <div className="text-xs text-gray-500 truncate">
            {row.start_time?.slice(0,5)} - {row.end_time?.slice(0,5)}
          </div>
        </div>
      ),
    },
    {
      key: 'total_amount',
      title: 'Amount',
      className: 'w-[12%]',
      render: (value: any) => {
        const num = Number(value);
        return (
          <span className="font-semibold text-xs">
            {Number.isFinite(num) ? formatCurrency(num) : '—'}
          </span>
        );
      },
    },
    {
      key: 'status',
      title: 'Status',
      className: 'w-[10%]',
      render: (value: string) => (
        <Badge variant={getStatusBadgeVariant(value)} className="text-xs px-1 py-0.5">
          {value.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'payment_status',
      title: 'Payment',
      className: 'w-[10%]',
      render: (value: string) => (
        <Badge variant={getStatusBadgeVariant(value)} className="text-xs px-1 py-0.5">
          {value.toUpperCase()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="w-full px-2 sm:px-3 py-2 sm:py-4 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Admin Dashboard</h1>
        <p className="text-sm text-gray-600">Manage bookings, users, and track revenue</p>
      </div>

      {/* Date Range Filter */}
      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4">
        <BookingOverview metrics={overviewMetrics} onMetricClick={handleMetricClick} />
      </div>

      {/* Revenue Chart */}
      {dashboard.daily_revenue.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Daily Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {dashboard.daily_revenue.slice(0, 10).map((day, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700 w-28">
                      {format(new Date(day.date), 'MMM dd, yyyy')}
                    </span>
                    <div className="flex-1">
                      <div
                        className="bg-green-500 h-4 rounded"
                        style={{
                          width: `${(day.revenue / Math.max(...dashboard.daily_revenue.map(d => d.revenue))) * 100}%`,
                          minWidth: '16px',
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      R {day.revenue.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {day.bookings} booking{day.bookings !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Bookings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table
            data={dashboard.recent_bookings}
            columns={bookingColumns}
            keyExtractor={(row) => row.id.toString()}
            emptyMessage="No recent bookings"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
