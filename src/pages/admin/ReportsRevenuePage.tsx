import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { RevenueReport, ReportFilters, BookingAnalytics } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import BookingOverview from '../../components/admin/BookingOverview';
import PaymentMethodsPie from '../../components/admin/charts/PaymentMethodsPie';
import RevenueTimelineLine from '../../components/admin/charts/RevenueTimelineLine';
import Button from '../../components/ui/Button';

const ReportsRevenuePage: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [analytics, setAnalytics] = useState<BookingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const [revenueData, analyticsData] = await Promise.all([
        reportService.getRevenueReport(filters),
        reportService.getBookingAnalytics(filters),
      ]);
      setReport(revenueData);
      setAnalytics(analyticsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const paymentMethods = (report?.payment_methods || []).filter(Boolean);

  const confirmedMethods = paymentMethods.filter(method => {
    const label = String(method.payment_method).toLowerCase();
    return label !== 'cancelled' && label !== 'manual_pending' && label !== 'pending';
  });

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

  const eligibleStatusCount = (statusMap['confirmed'] ?? 0) + (statusMap['completed'] ?? 0);

  const paidBookingsFromMethods = confirmedMethods.reduce((sum, method) => {
    const payments = Number(method?.total_payments ?? 0);
    return sum + (Number.isFinite(payments) ? payments : 0);
  }, 0);

  const trends = analytics?.booking_trends ?? [];
  const paidBookingsRaw = trends.reduce((sum, trend) => sum + (trend?.paid_bookings ?? 0), 0);
  const cancelledBookingsRaw = trends.reduce((sum, trend) => sum + (trend?.cancelled_bookings ?? 0), 0);

  const fallbackConfirmed = analytics?.overall_stats?.confirmed_bookings ?? 0;
  const fallbackCancelled = analytics?.overall_stats?.cancelled_bookings ?? 0;
  const totalBookingsReported = analytics?.overall_stats?.total_bookings ?? report?.overall_stats?.total_bookings ?? 0;

  const paidEligible = paidBookingsFromMethods > 0 ? paidBookingsFromMethods : (paidBookingsRaw > 0 ? paidBookingsRaw : fallbackConfirmed);
  const statusEligible = eligibleStatusCount > 0 ? eligibleStatusCount : fallbackConfirmed;

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
  const confirmedBookingCount = confirmedBookings;

  const confirmedRevenueRaw = (analytics?.peak_hours ?? []).reduce((sum, entry) => {
    const revenue = Number(entry?.revenue ?? 0);
    return sum + (Number.isFinite(revenue) ? revenue : 0);
  }, 0);

  const fallbackRevenue = analytics?.overall_stats?.total_revenue ?? 0;
  const confirmedRevenueFromMethods = confirmedMethods.reduce((sum, method) => {
    const amount = Number(method.total_amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const confirmedRevenue = confirmedRevenueRaw > 0
    ? confirmedRevenueRaw
    : fallbackRevenue > 0
      ? fallbackRevenue
      : confirmedRevenueFromMethods;

  return (
    <div className="container mx-auto px-4 py-8 max-w-screen-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Revenue Report</h1>
      </div>

      <Card className="mb-4">
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
              <select
                value={filters.group_by || 'day'}
                onChange={(e) => setFilters({ ...filters, group_by: (e.target.value as any) })}
                className="px-3 py-2 border rounded-lg w-full"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input type="date" className="px-3 py-2 border rounded-lg w-full" value={filters.from_date || ''} onChange={(e) => setFilters({ ...filters, from_date: e.target.value || undefined })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input type="date" className="px-3 py-2 border rounded-lg w-full" value={filters.to_date || ''} onChange={(e) => setFilters({ ...filters, to_date: e.target.value || undefined })} />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={() => report && reportService.exportReport({ type: 'revenue', format: 'csv', from_date: filters.from_date, to_date: filters.to_date })}>Export CSV</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!report || !analytics || loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <BookingOverview
                compact
                metrics={{
                  total_revenue: confirmedRevenue,
                  confirmed_bookings: confirmedBookingCount,
                  pending_payments: pendingBookings > 0 ? pendingBookings : undefined,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
            <CardContent>
              <PaymentMethodsPie data={confirmedMethods} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Revenue Timeline</CardTitle></CardHeader>
            <CardContent>
              <RevenueTimelineLine data={report.revenue_timeline} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportsRevenuePage;
