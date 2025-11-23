import React, { useState, useEffect } from 'react';
import Button from '../ui/Button';
import { paymentService } from '../../services/paymentService';
import { useQueryClient } from 'react-query';
import { CreditCard, type LucideIcon } from 'lucide-react';

interface PayButtonProps {
  bookingId: number;
  method?: 'online' | 'eft' | 'cash' | 'card';
  label?: string;
  icon?: LucideIcon;
}

const PayButton: React.FC<PayButtonProps> = ({ bookingId, method = 'online', label = 'Pay Now', icon = CreditCard }) => {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Monitor for when user returns from payment (tab becomes visible again)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to this tab - invalidate bookings cache to force fresh fetch
        setTimeout(() => {
          queryClient.invalidateQueries(['bookings']);
        }, 500); // Small delay to ensure payment is processed
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);

  const handlePay = async () => {
    try {
      setLoading(true);
      const res = await paymentService.processPayment({ booking_id: bookingId, payment_method: method });
      if (res.gateway_url && res.gateway_data) {
        paymentService.redirectToPayment(res.gateway_url, res.gateway_data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handlePay} disabled={loading} size="sm" icon={icon}>
      {loading ? 'Processing...' : label}
    </Button>
  );
};

export default PayButton;
