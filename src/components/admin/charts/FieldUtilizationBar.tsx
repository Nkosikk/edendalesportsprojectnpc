import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface FieldUtilizationDatum {
  field_name: string;
  total_bookings: number;
  utilization_percentage: number;
}

export const FieldUtilizationBar: React.FC<{ data: FieldUtilizationDatum[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-xs text-gray-500">No field utilization data.</div>;
  }
  const top = [...data].sort((a,b) => b.total_bookings - a.total_bookings).slice(0, 10);
  const chartData = {
    labels: top.map(d => d.field_name),
    datasets: [
      {
        label: 'Bookings',
        data: top.map(d => d.total_bookings),
        backgroundColor: '#2563eb',
        maxBarThickness: 18
      },
      {
        label: 'Utilization %',
        data: top.map(d => Number((d.utilization_percentage || 0).toFixed(2))),
        backgroundColor: '#10b981',
        maxBarThickness: 18
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 12 } } },
    scales: {
      y: { beginAtZero: true },
      x: { ticks: { autoSkip: true, maxTicksLimit: 8 } },
    },
  } as const;
  const containerStyle: React.CSSProperties = { height: 260, width: '100%' };
  return (
    <div style={containerStyle}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default FieldUtilizationBar;
