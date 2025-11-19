import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { BookingAnalytics, ReportFilters } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import BookingOverview from '../../components/admin/BookingOverview';
import PeakHoursBar from '../../components/admin/charts/PeakHoursBar';
import FieldUtilizationBar from '../../components/admin/charts/FieldUtilizationBar';
import Button from '../../components/ui/Button';

const ReportsAnalyticsPage: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({});
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

  return (
    <div className="container mx-auto px-4 py-8">
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
                  total_bookings: analytics.overall_stats.total_bookings,
                  total_hours: analytics.overall_stats.total_hours,
                  total_revenue: analytics.overall_stats.total_revenue,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Peak Hours</CardTitle></CardHeader>
            <CardContent>
              <PeakHoursBar data={analytics.peak_hours} />
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
