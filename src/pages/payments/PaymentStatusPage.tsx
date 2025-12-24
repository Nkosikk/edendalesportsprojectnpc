import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { paymentService } from '../../services/paymentService';
import type { PaymentStatus } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const PaymentStatusPage: React.FC = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const payment_reference = params.get('payment_reference') || params.get('pf_payment_id') || undefined;
  const booking_id = params.get('booking_id') ? Number(params.get('booking_id')) : undefined;
  
  // Detect flow type from URL path
  const isSuccessFlow = location.pathname.includes('/success');
  const isCancelFlow = location.pathname.includes('/cancel');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        
        // If we have payment reference or booking ID, try to fetch status
        if (payment_reference || booking_id) {
          const data = await paymentService.getPaymentStatus(payment_reference, booking_id);
          setStatus(data);
          
          // Show appropriate toast based on payment status
          if (data?.payment?.status === 'completed') {
            toast.success('Payment successful! Your booking is confirmed.');
          } else if (data?.payment?.status === 'failed' || isCancelFlow) {
            toast.error('Payment was cancelled or failed.');
          }
        } else if (isSuccessFlow) {
          // PayFast returned to success URL but didn't pass reference
          // Show success message anyway - ITN will update the actual status
          toast.success('Payment completed! Your booking will be confirmed shortly.');
        } else if (isCancelFlow) {
          toast.error('Payment was cancelled.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [payment_reference, booking_id, isCancelFlow, isSuccessFlow]);

  const handleBackToDashboard = () => {
    navigate('/app');
  };

  const getStatusIcon = (paymentStatus?: string) => {
    // Use URL path to determine status if no payment data
    if (!paymentStatus) {
      if (isSuccessFlow) return <CheckCircle className="h-8 w-8 text-green-600" />;
      if (isCancelFlow) return <XCircle className="h-8 w-8 text-red-600" />;
      return <Clock className="h-8 w-8 text-gray-600" />;
    }
    
    switch (paymentStatus) {
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      case 'failed':
        return <XCircle className="h-8 w-8 text-red-600" />;
      case 'processing':
        return <Clock className="h-8 w-8 text-yellow-600" />;
      default:
        return <Clock className="h-8 w-8 text-gray-600" />;
    }
  };

  const getStatusMessage = (paymentStatus?: string) => {
    // Use URL path to determine message if no payment data
    if (!paymentStatus) {
      if (isSuccessFlow) return 'Payment completed! Your booking will be confirmed shortly.';
      if (isCancelFlow) return 'Payment was cancelled.';
      return 'Payment status unknown';
    }
    
    if (isCancelFlow) return 'Payment was cancelled';
    switch (paymentStatus) {
      case 'completed':
        return 'Payment successful! Your booking is confirmed.';
      case 'failed':
        return 'Payment failed. Please try again.';
      case 'processing':
        return 'Payment is being processed...';
      default:
        return 'Payment status unknown';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : !status && !isCancelFlow && !isSuccessFlow ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No payment information found.</p>
              <Button onClick={handleBackToDashboard}>Back to Dashboard</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Icon and Message */}
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {getStatusIcon(status?.payment?.status)}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {getStatusMessage(status?.payment?.status)}
                </h3>
                {isSuccessFlow && !status && (
                  <p className="text-sm text-gray-500 mt-2">
                    Your payment has been received. The booking confirmation will be processed automatically.
                  </p>
                )}
              </div>

              {/* Payment Details */}
              {status && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex justify-between"><span className="text-gray-600">Payment Reference</span><span className="font-medium">{status.payment.payment_reference}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Booking Reference</span><span>{status.payment.booking_reference}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Amount</span><span className="font-semibold">R {Number(status.payment.amount || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className={`uppercase font-semibold ${
                      status.payment.status === 'completed' ? 'text-green-600' : 
                      status.payment.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {status.payment.status}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-600">Method</span><span>{status.payment.payment_method}</span></div>
                  {status.payment.processed_at && (
                    <div className="flex justify-between"><span className="text-gray-600">Processed At</span><span>{new Date(status.payment.processed_at).toLocaleString()}</span></div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={handleBackToDashboard} className="flex-1">
                  Back to Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/app/bookings')} 
                  className="flex-1"
                >
                  View My Bookings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentStatusPage;
