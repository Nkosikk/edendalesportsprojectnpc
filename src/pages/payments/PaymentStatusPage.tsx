import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { paymentService } from '../../services/paymentService';
import type { PaymentStatus } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { CheckCircle, XCircle, Clock, CreditCard, Building2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const PaymentStatusPage: React.FC = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // PayFast can return various parameters - try multiple options
  const payment_reference = params.get('payment_reference') 
    || params.get('pf_payment_id') 
    || params.get('m_payment_id')  // PayFast merchant payment ID
    || params.get('custom_str1')   // Custom field we might have set
    || undefined;
  const booking_id = params.get('booking_id') 
    ? Number(params.get('booking_id')) 
    : params.get('custom_int1') 
      ? Number(params.get('custom_int1'))  // Custom field for booking ID
      : undefined;
  
  // Detect flow type from URL path
  const isSuccessFlow = location.pathname.includes('/success');
  const isCancelFlow = location.pathname.includes('/cancel');

  // Poll for payment status update (PayFast ITN may take a few seconds)
  useEffect(() => {
    let pollCount = 0;
    const maxPolls = 10; // Poll up to 10 times (30 seconds total)
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        if (payment_reference || booking_id) {
          const data = await paymentService.getPaymentStatus(payment_reference, booking_id);
          setStatus(data);
          
          // If payment is completed or failed, stop polling
          if (data?.payment?.status === 'completed') {
            toast.success('Payment successful! Your booking is confirmed.');
            if (pollInterval) clearInterval(pollInterval);
            setPolling(false);
            return true;
          } else if (data?.payment?.status === 'failed') {
            toast.error('Payment failed.');
            if (pollInterval) clearInterval(pollInterval);
            setPolling(false);
            return true;
          }
        }
        return false;
      } catch (error) {
        console.error('Error fetching payment status:', error);
        return false;
      }
    };

    const load = async () => {
      setLoading(true);
      
      // Initial fetch
      const completed = await fetchStatus();
      setLoading(false);
      
      // If success flow and payment not yet completed, start polling
      if (isSuccessFlow && !completed && (payment_reference || booking_id)) {
        setPolling(true);
        toast.success('Payment received! Confirming your booking...');
        
        pollInterval = setInterval(async () => {
          pollCount++;
          const done = await fetchStatus();
          
          if (done || pollCount >= maxPolls) {
            if (pollInterval) clearInterval(pollInterval);
            setPolling(false);
            
            if (!done && pollCount >= maxPolls) {
              toast.success('Payment processed! Your booking will be confirmed shortly.');
            }
          }
        }, 3000); // Poll every 3 seconds
      } else if (isSuccessFlow && !payment_reference && !booking_id) {
        // No reference passed - show generic success
        toast.success('Payment completed! Your booking will be confirmed shortly.');
      } else if (isCancelFlow) {
        toast.error('Payment was cancelled.');
      }
    };

    load();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [payment_reference, booking_id, isSuccessFlow, isCancelFlow]);

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
    <div className="min-h-screen flex items-center justify-center px-4 py-4 sm:py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-center text-lg sm:text-xl">
            {isCancelFlow ? 'Payment Cancelled' : 'Payment Status'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {loading ? (
            <div className="flex justify-center py-6"><LoadingSpinner /></div>
          ) : isCancelFlow ? (
            /* Cancellation Screen - Optimized for single screen view */
            <div className="space-y-4">
              <div className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="bg-red-100 rounded-full p-3">
                    <XCircle className="h-8 w-8 sm:h-10 sm:w-10 text-red-600" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">
                  Payment Cancelled
                </h3>
                <p className="text-sm text-gray-600">
                  Your booking is reserved but requires payment to be confirmed.
                </p>
              </div>

              {/* Payment Options - Compact */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 mb-2 text-sm">What would you like to do?</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                    <CreditCard className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Pay Online</p>
                      <p className="text-xs text-gray-600">Complete payment via PayFast</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                    <Building2 className="h-4 w-4 text-primary-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Manual Payment</p>
                      <p className="text-xs text-gray-600">EFT or cash at reception</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Details - Compact */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2 text-sm">Banking Details</h4>
                <div className="text-xs sm:text-sm text-blue-800 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <p><span className="font-medium">Bank:</span> First National Bank (FNB)</p>
                  <p><span className="font-medium">Account Type:</span> Gold Business Account</p>
                  <p><span className="font-medium">Account Name:</span> Edendale Sports Projects NPC</p>
                  <p><span className="font-medium">Account Number:</span> 63134355858</p>
                  <p><span className="font-medium">Branch Code:</span> 221325</p>
                  <p><span className="font-medium">Branch Name:</span> Boom Street 674</p>
                  <p><span className="font-medium">Swift Code:</span> FIRNZAJJ</p>
                  <p><span className="font-medium">Reference:</span> Your booking reference</p>
                </div>
              </div>

              {/* Action Buttons - Compact */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <Button 
                  onClick={() => navigate('/app/bookings')} 
                  className="flex-1 text-sm py-2"
                  size="sm"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Go to My Bookings
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleBackToDashboard}
                  className="flex-1 text-sm py-2"
                  size="sm"
                >
                  Back to Dashboard
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Need help? bookings@edendalesports.co.za | +27 33 123 4567
              </p>
            </div>
          ) : !status && !isSuccessFlow ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No payment information found.</p>
              <Button onClick={handleBackToDashboard}>Back to Dashboard</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Icon and Message */}
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {polling ? (
                    <div className="animate-pulse">
                      <Clock className="h-8 w-8 text-yellow-600" />
                    </div>
                  ) : (
                    getStatusIcon(status?.payment?.status)
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {polling ? 'Confirming your payment...' : getStatusMessage(status?.payment?.status)}
                </h3>
                {polling && (
                  <p className="text-sm text-gray-500 mt-2">
                    Please wait while we confirm your payment with PayFast.
                  </p>
                )}
                {isSuccessFlow && !status && !polling && (
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
