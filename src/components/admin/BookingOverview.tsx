import React from 'react';

export interface BookingOverviewMetrics {
  total_bookings?: number;
  total_hours?: number;
  total_revenue?: number;
  confirmed_bookings?: number;
  cancelled_bookings?: number;
  pending_payments?: number;
  total_users?: number;
}

interface BookingOverviewProps {
  metrics: BookingOverviewMetrics;
  title?: string;
  compact?: boolean;
  onMetricClick?: (metric: keyof BookingOverviewMetrics) => void;
}

const statConfig: { key: keyof BookingOverviewMetrics; label: string; format?: (v: number) => string }[] = [
  { key: 'total_revenue', label: 'Total Revenue', format: v => `R ${Number(v || 0).toFixed(2)}` },
  { key: 'total_bookings', label: 'Total Bookings' },
  { key: 'confirmed_bookings', label: 'Confirmed' },
  { key: 'pending_payments', label: 'Pending Payments' },
  { key: 'total_hours', label: 'Total Hours', format: v => Number(v || 0).toFixed(1) },
  { key: 'total_users', label: 'Users' },
];

const BookingOverview: React.FC<BookingOverviewProps> = ({ metrics, title = 'Overview', compact, onMetricClick }) => {
  const activeStats = statConfig.filter(s => typeof metrics[s.key] === 'number');
  const isInteractive = typeof onMetricClick === 'function';
  return (
    <div>
      {!compact && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
      <div className={`grid gap-4 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-6'}`}>
        {activeStats.map(stat => {
          const raw = metrics[stat.key] as number;
          const display = stat.format ? stat.format(raw) : raw.toString();
          const baseClasses = 'rounded-lg border bg-white p-4 shadow-sm h-full';
          const interactiveClasses = isInteractive
            ? ' transition-transform hover:-translate-y-1 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer'
            : '';

          if (isInteractive) {
            return (
              <button
                key={stat.key}
                type="button"
                onClick={() => onMetricClick?.(stat.key)}
                className={`${baseClasses}${interactiveClasses}`}
              >
                <p className="text-xs font-medium text-gray-600 mb-1">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">{display}</p>
              </button>
            );
          }

          return (
            <div key={stat.key} className={baseClasses}>
              <p className="text-xs font-medium text-gray-600 mb-1">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">{display}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingOverview;
