import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

interface RevenuePoint {
  period: string;
  revenue: number;
  bookings: number;
  total_hours: number;
}

export const RevenueTimelineLine: React.FC<{ data: RevenuePoint[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-xs text-gray-500">No timeline data.</div>;
  }
  const chartData = {
    labels: data.map(d => d.period),
    datasets: [
      {
        label: 'Revenue (R)',
        data: data.map(d => d.revenue),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.3)',
        tension: 0.25,
        fill: true,
      },
      {
        label: 'Bookings',
        data: data.map(d => d.bookings),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.3)',
        tension: 0.25,
        fill: true,
        yAxisID: 'y1'
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    stacked: false,
    plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12 } } },
    elements: { point: { radius: 2 }, line: { borderWidth: 2 } },
    scales: {
      y: { type: 'linear' as const, position: 'left' as const },
      y1: { type: 'linear' as const, position: 'right' as const, grid: { drawOnChartArea: false } }
    }
  } as const;
  const containerStyle: React.CSSProperties = { height: 260, width: '100%' };
  return (
    <div style={containerStyle}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default RevenueTimelineLine;
