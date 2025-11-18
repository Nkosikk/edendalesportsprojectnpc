import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { paymentService } from '../../services/paymentService';
import type { PaymentStatus } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

const PaymentStatusPage: React.FC = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const payment_reference = params.get('payment_reference') || undefined;
  const booking_id = params.get('booking_id') ? Number(params.get('booking_id')) : undefined;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await paymentService.getPaymentStatus(payment_reference, booking_id);
        setStatus(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [payment_reference, booking_id]);

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : !status ? (
            <p className="text-gray-500">No payment information found.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-600">Payment Reference</span><span className="font-medium">{status.payment.payment_reference}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Booking Reference</span><span>{status.payment.booking_reference}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Amount</span><span>R {status.payment.amount?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Status</span><span className="uppercase font-semibold">{status.payment.status}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Method</span><span>{status.payment.payment_method}</span></div>
              {status.payment.processed_at && (
                <div className="flex justify-between"><span className="text-gray-600">Processed At</span><span>{new Date(status.payment.processed_at).toLocaleString()}</span></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentStatusPage;
