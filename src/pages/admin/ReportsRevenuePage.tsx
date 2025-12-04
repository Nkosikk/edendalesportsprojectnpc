import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { RevenueReport, ReportFilters } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import BookingOverview from '../../components/admin/BookingOverview';
import PaymentMethodsPie from '../../components/admin/charts/PaymentMethodsPie';
import RevenueTimelineLine from '../../components/admin/charts/RevenueTimelineLine';
import Button from '../../components/ui/Button';

const ReportsRevenuePage: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await reportService.getRevenueReport(filters);
      setReport(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

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

      {!report || loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <BookingOverview
                compact
                metrics={{
                  total_revenue: report.overall_stats.total_revenue,
                  total_bookings: report.overall_stats.total_bookings,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
            <CardContent>
              <PaymentMethodsPie data={report.payment_methods} />
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
