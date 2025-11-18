import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge, getStatusBadgeVariant } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { adminService } from '../../services/adminService';
import type { DashboardData, BookingDetails } from '../../types';
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

  const stats = [
    {
      title: 'Total Revenue',
      value: `R ${dashboard.summary.total_revenue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Total Bookings',
      value: dashboard.summary.total_bookings.toString(),
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Confirmed',
      value: dashboard.summary.confirmed_bookings.toString(),
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: 'Pending Payments',
      value: dashboard.summary.pending_payments.toString(),
      icon: AlertCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Total Hours',
      value: dashboard.summary.total_hours.toFixed(1),
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Total Users',
      value: dashboard.summary.total_users.toString(),
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  ];

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
      render: (value: number) => (
        <span className="font-semibold">R {value.toFixed(2)}</span>
      ),
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
