import React, { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import BookingOverview from '../../components/admin/BookingOverview';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { adminService } from '../../services/adminService';
import type { DashboardData, BookingDetails } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const AdminDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dateRange, setDateRange] = useState({
    from: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    fetchDashboard();
  }, [dateRange]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await adminService.getDashboard(dateRange.from, dateRange.to);
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
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      ),
    },
    {
      key: 'first_name',
      title: 'Customer',
      render: (_: any, row: BookingDetails) => (
        <div>
          <div className="font-medium">{`${row.first_name} ${row.last_name}`}</div>
          <div className="text-sm text-gray-500">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'field_name',
      title: 'Field',
    },
    {
      key: 'booking_date',
      title: 'Date & Time',
      render: (_: any, row: BookingDetails) => (
        <div>
          <div>{format(new Date(row.booking_date), 'MMM dd, yyyy')}</div>
          <div className="text-sm text-gray-500">
            {row.start_time} - {row.end_time}
          </div>
        </div>
      ),
    },
    {
      key: 'total_amount',
      title: 'Amount',
      render: (value: any) => {
        const num = Number(value);
        return (
          <span className="font-semibold">
            {Number.isFinite(num) ? formatCurrency(num) : '—'}
          </span>
        );
      },
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: string) => (
        <Badge variant={getStatusBadgeVariant(value)}>
          {value.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'payment_status',
      title: 'Payment',
      render: (value: string) => (
        <Badge variant={getStatusBadgeVariant(value)}>
          {value.toUpperCase()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage bookings, users, and track revenue</p>
      </div>

      {/* Date Range Filter */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-8">
        <BookingOverview metrics={overviewMetrics} />
      </div>

      {/* Revenue Chart */}
      {dashboard.daily_revenue.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Daily Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.daily_revenue.slice(0, 10).map((day, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700 w-28">
                      {format(new Date(day.date), 'MMM dd, yyyy')}
                    </span>
                    <div className="flex-1">
                      <div
                        className="bg-green-500 h-6 rounded"
                        style={{
                          width: `${(day.revenue / Math.max(...dashboard.daily_revenue.map(d => d.revenue))) * 100}%`,
                          minWidth: '20px',
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
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
        </CardHeader>
        <CardContent>
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
