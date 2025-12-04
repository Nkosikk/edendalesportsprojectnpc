import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import type { DashboardData } from '../../types';
import BookingOverview from '../../components/admin/BookingOverview';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import Button from '../../components/ui/Button';

const BookingOverviewPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const load = async () => {
    try {
      setLoading(true);
      const d = await adminService.getDashboard(from, to);
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [from, to]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-gray-600">No data available.</div>;
  }

  const metrics = {
    total_bookings: data.summary.total_bookings,
    total_hours: data.summary.total_hours,
    total_revenue: data.summary.total_revenue,
    confirmed_bookings: data.summary.confirmed_bookings,
    pending_payments: data.summary.pending_payments,
    total_users: data.summary.total_users,
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-screen-xl">
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking Overview</h1>
          <p className="text-xs text-gray-600">Aggregated performance metrics for the selected period.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700">From</label>
            <input type="date" className="input text-xs" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
            <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700">To</label>
            <input type="date" className="input text-xs" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>
      <BookingOverview metrics={metrics} />
    </div>
  );
};

export default BookingOverviewPage;
