import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface PeakHour {
  hour: number;
  bookings: number;
  revenue: number;
}

export const PeakHoursBar: React.FC<{ data: PeakHour[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-xs text-gray-500">No peak hour data.</div>;
  }
  const sorted = [...data].sort((a,b) => a.hour - b.hour).slice(0, 24);
  const chartData = {
    labels: sorted.map(d => `${d.hour}:00`),
    datasets: [
      {
        label: 'Bookings',
        data: sorted.map(d => d.bookings),
        backgroundColor: '#6366f1',
        maxBarThickness: 18
      },
      {
        label: 'Revenue (R)',
        data: sorted.map(d => d.revenue),
        backgroundColor: '#f59e0b',
        maxBarThickness: 18
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 12 } },
    },
    scales: {
      y: { beginAtZero: true },
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
    },
  } as const;

  const containerStyle: React.CSSProperties = { height: 260, width: '100%' };
  return (
    <div style={containerStyle}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default PeakHoursBar;
