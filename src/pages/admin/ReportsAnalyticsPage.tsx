import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { BookingAnalytics, ReportFilters } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import BookingOverview from '../../components/admin/BookingOverview';
import PeakHoursBar from '../../components/admin/charts/PeakHoursBar';
import FieldUtilizationBar from '../../components/admin/charts/FieldUtilizationBar';
import Button from '../../components/ui/Button';

// Helper to get date string in YYYY-MM-DD format
const formatDate = (date: Date): string => date.toISOString().split('T')[0];

// Get default date range: first of current month to 3 months ahead
const getDefaultFilters = (): ReportFilters => {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const threeMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 3, 0); // Last day of month 3 months from now
  return {
    from_date: formatDate(firstOfMonth),
    to_date: formatDate(threeMonthsAhead),
  };
};

const ReportsAnalyticsPage: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>(getDefaultFilters());
  const [analytics, setAnalytics] = useState<BookingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await reportService.getBookingAnalytics(filters);
      setAnalytics(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const trends = analytics?.booking_trends ?? [];

  const paidBookingsRaw = trends.reduce((sum, trend) => sum + (trend?.paid_bookings ?? 0), 0);
  const cancelledBookingsRaw = trends.reduce((sum, trend) => sum + (trend?.cancelled_bookings ?? 0), 0);

  const statusMap = (analytics?.status_distribution ?? []).reduce<Record<string, number>>((acc, entry) => {
    const key = String(entry?.status ?? '').toLowerCase();
    const source = entry as unknown as { count?: number; bookings?: number };
    const count = Number(source?.count ?? source?.bookings ?? 0);
    if (!key || !Number.isFinite(count) || count <= 0) {
      return acc;
    }
    acc[key] = (acc[key] ?? 0) + count;
    return acc;
  }, {});

  // Support both booking_stats (from API) and overall_stats (legacy)
  const stats = analytics?.booking_stats ?? analytics?.overall_stats;
  const fallbackConfirmed = stats?.confirmed_bookings ?? 0;
  const fallbackCancelled = stats?.cancelled_bookings ?? 0;
  const totalBookingsReported = stats?.total_bookings ?? 0;

  const paidEligible = paidBookingsRaw > 0 ? paidBookingsRaw : fallbackConfirmed;
  const statusEligible = (statusMap['confirmed'] ?? 0) + (statusMap['completed'] ?? 0);

  // Treat confirmed bookings as the intersection of paid bookings and confirmed/completed statuses.
  let confirmedBookings = 0;
  if (paidEligible > 0 && statusEligible > 0) {
    confirmedBookings = Math.min(paidEligible, statusEligible);
  } else {
    confirmedBookings = Math.max(paidEligible, statusEligible);
  }
  if (confirmedBookings <= 0) {
    confirmedBookings = fallbackConfirmed > 0 ? fallbackConfirmed : paidBookingsRaw;
  }

  const cancelledEligible = statusMap['cancelled'] ?? 0;
  const cancelledBookings = cancelledEligible > 0 ? cancelledEligible : (fallbackCancelled > 0 ? fallbackCancelled : cancelledBookingsRaw);
  const pendingBookings = Math.max(0, totalBookingsReported - confirmedBookings - cancelledBookings);
  const totalBookingsDisplay = totalBookingsReported > 0 ? totalBookingsReported : confirmedBookings + pendingBookings;

  const confirmedRevenueRaw = (analytics?.peak_hours ?? []).reduce((sum, entry) => {
    const revenue = Number(entry?.revenue ?? 0);
    return sum + (Number.isFinite(revenue) ? revenue : 0);
  }, 0);

  const hoursFromPeak = (analytics?.peak_hours ?? []).reduce((sum, entry) => {
    const bookings = Number(entry?.bookings ?? 0);
    return sum + (Number.isFinite(bookings) ? bookings : 0);
  }, 0);

  const hoursFromFieldUtil = (analytics?.field_utilization ?? []).reduce((sum, field) => {
    const hours = Number(field?.booked_hours ?? 0);
    return sum + (Number.isFinite(hours) ? hours : 0);
  }, 0);

  const fallbackRevenue = Number(stats?.total_revenue ?? 0);
  const fallbackHours = Number(stats?.total_hours ?? 0);

  const confirmedRevenue = confirmedRevenueRaw > 0 ? confirmedRevenueRaw : fallbackRevenue;
  const paidHours = hoursFromPeak > 0
    ? hoursFromPeak
    : (hoursFromFieldUtil > 0 ? hoursFromFieldUtil : fallbackHours);

  return (
    <div className="container mx-auto px-4 py-8 max-w-screen-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Booking Analytics</h1>
      </div>

      <Card className="mb-4">
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input type="date" className="px-3 py-2 border rounded-lg w-full" value={filters.from_date || ''} onChange={(e) => setFilters({ ...filters, from_date: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input type="date" className="px-3 py-2 border rounded-lg w-full" value={filters.to_date || ''} onChange={(e) => setFilters({ ...filters, to_date: e.target.value || undefined })} />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={() => analytics && reportService.exportReport({ type: 'bookings', format: 'csv', from_date: filters.from_date, to_date: filters.to_date })}>Export CSV</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!analytics || loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <BookingOverview
                compact
                metrics={{
                  total_revenue: confirmedRevenue,
                  total_bookings: totalBookingsDisplay,
                  confirmed_bookings: confirmedBookings,
                  pending_payments: pendingBookings > 0 ? pendingBookings : undefined,
                  cancelled_bookings: cancelledBookings > 0 ? cancelledBookings : undefined,
                  total_hours: paidHours,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Peak Hours</CardTitle></CardHeader>
            <CardContent>
              <PeakHoursBar data={analytics.peak_hours.map(h => ({ ...h, revenue: Number(h.revenue) }))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Top Field Utilization</CardTitle></CardHeader>
            <CardContent>
              <FieldUtilizationBar data={analytics.field_utilization} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportsAnalyticsPage;
