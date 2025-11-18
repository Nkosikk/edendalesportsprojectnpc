import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { BookingAnalytics, ReportFilters } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

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
          </div>
        </CardContent>
      </Card>

      {!analytics || loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Overall Stats</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><div className="text-gray-600">Total Bookings</div><div className="text-xl font-bold">{analytics.overall_stats.total_bookings}</div></div>
                <div><div className="text-gray-600">Total Hours</div><div className="text-xl font-bold">{analytics.overall_stats.total_hours}</div></div>
                <div><div className="text-gray-600">Total Revenue</div><div className="text-xl font-bold">R {analytics.overall_stats.total_revenue.toFixed(2)}</div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Peak Hours</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analytics.peak_hours.slice(0, 10).map((h, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-16 text-sm text-gray-600">{h.hour}:00</div>
                    <div className="flex-1 bg-blue-500 h-3 rounded" style={{ width: `${(h.bookings / Math.max(...analytics.peak_hours.map(x => x.bookings))) * 100}%`, minWidth: '10px' }} />
                    <div className="w-16 text-right text-sm">{h.bookings}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportsAnalyticsPage;
