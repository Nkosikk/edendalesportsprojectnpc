import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PaymentMethodDatum {
  payment_method: string;
  total_payments: number;
  total_amount: number;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#14b8a6'];

export const PaymentMethodsPie: React.FC<{ data: PaymentMethodDatum[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-xs text-gray-500">No payment data.</div>;
  }
  const chartData = {
    labels: data.map(d => d.payment_method),
    datasets: [
      {
        label: 'Revenue',
        data: data.map(d => d.total_amount),
        backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]),
        borderWidth: 0,
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const, // Ensure type compatibility
      },
    },
  };

  const styles = {
    chartContainer: {
      width: '300px', // Further reduce width
      height: '300px', // Further reduce height
      margin: '0 auto',
    },
  };

  return (
    <div style={styles.chartContainer}>
      <Pie data={chartData} options={options} />
    </div>
  );
};

export default PaymentMethodsPie;
