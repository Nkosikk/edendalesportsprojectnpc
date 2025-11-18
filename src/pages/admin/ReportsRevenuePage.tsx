import React, { useEffect, useState } from 'react';
import { reportService } from '../../services/reportService';
import type { RevenueReport, ReportFilters } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

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
    <div className="container mx-auto px-4 py-8">
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
          </div>
        </CardContent>
      </Card>

      {!report || loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><div className="text-gray-600">Total Revenue</div><div className="text-xl font-bold">R {report.overall_stats.total_revenue.toFixed(2)}</div></div>
                <div><div className="text-gray-600">Total Bookings</div><div className="text-xl font-bold">{report.overall_stats.total_bookings}</div></div>
                <div><div className="text-gray-600">Average Value</div><div className="text-xl font-bold">R {report.overall_stats.average_booking_value.toFixed(2)}</div></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.revenue_timeline.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-40 text-sm text-gray-600">{p.period}</div>
                    <div className="flex-1 bg-green-500 h-4 rounded" style={{ width: `${(p.revenue / Math.max(...report.revenue_timeline.map(x => x.revenue))) * 100}%`, minWidth: '10px' }} />
                    <div className="w-24 text-right font-medium">R {p.revenue.toFixed(2)}</div>
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

export default ReportsRevenuePage;
