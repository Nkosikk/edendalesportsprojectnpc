import React, { useState } from 'react';
import Button from '../ui/Button';
import { paymentService } from '../../services/paymentService';

interface PayButtonProps {
  bookingId: number;
  method?: 'online' | 'eft' | 'cash' | 'card';
  label?: string;
}

const PayButton: React.FC<PayButtonProps> = ({ bookingId, method = 'online', label = 'Pay Now' }) => {
  const [loading, setLoading] = useState(false);

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
    <Button onClick={handlePay} disabled={loading} size="sm">
      {loading ? 'Processing...' : label}
    </Button>
  );
};

export default PayButton;
