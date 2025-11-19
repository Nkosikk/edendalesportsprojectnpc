import apiClient, { handleApiResponse } from '../lib/api';
import type {
  CreatePaymentRequest,
  PaymentResponse,
  PaymentStatus,
  ApiResponse,
} from '../types';

/**
 * Payment Service
 * Handles payment processing and status tracking
 */

export const paymentService = {
  /**
   * Process/initiate a payment
   */
  processPayment: async (data: CreatePaymentRequest): Promise<PaymentResponse> => {
    const response = await apiClient.post<ApiResponse<PaymentResponse>>('/payments', data);
    return handleApiResponse<PaymentResponse>(response);
  },

  /**
   * Confirm manual payment (Staff/Admin only)
   */
  confirmPayment: async (paymentId?: number, bookingId?: number): Promise<void> => {
    const response = await apiClient.post<ApiResponse>('/payments/confirm', {
      payment_id: paymentId,
      booking_id: bookingId,
    });
    return handleApiResponse<void>(response);
  },

  /**
   * Get payment status
   */
  getPaymentStatus: async (
    paymentReference?: string,
    bookingId?: number
  ): Promise<PaymentStatus> => {
    try {
      const response = await apiClient.get<ApiResponse<PaymentStatus>>('/payments/status', {
        params: {
          payment_reference: paymentReference,
          booking_id: bookingId,
        },
      });
      return handleApiResponse<PaymentStatus>(response);
    } catch (e: any) {
      const status = e?.response?.status;
      const message: string | undefined = e?.response?.data?.message || e?.message;
      // Gracefully handle missing payment scenario (no payment initiated yet)
      if (status === 404 || (message && /payment\s+not\s+found/i.test(message))) {
        // Mark as handled so callers can suppress duplicate toasts
        (e as any)._toastShown = true;
        return {
          payment: {
            id: 0,
            payment_reference: '',
            booking_reference: bookingId ? String(bookingId) : '',
            payment_method: 'online',
            amount: 0,
            currency: 'ZAR',
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        } as PaymentStatus;
      }
      throw e;
    }
  },

  /**
   * Open PayFast payment gateway
   * This will redirect the user to PayFast payment page
   */
  redirectToPayment: (gatewayUrl: string, gatewayData: Record<string, any>) => {
    // Determine final action URL based on env override or provided gateway URL
    const mode = (import.meta.env.VITE_PAYFAST_MODE || 'auto') as 'auto' | 'sandbox' | 'live';
    const sandboxUrl = import.meta.env.VITE_PAYFAST_SANDBOX_URL || 'https://sandbox.payfast.co.za/eng/process';
    const liveUrl = import.meta.env.VITE_PAYFAST_LIVE_URL || 'https://www.payfast.co.za/eng/process';

    const resolveGatewayUrl = (provided?: string) => {
      if (mode === 'sandbox') return sandboxUrl;
      if (mode === 'live') return liveUrl;
      return provided || liveUrl; // default to provided; fallback to live
    };

    const actionUrl = resolveGatewayUrl(gatewayUrl);

    // Create form in current window (hidden)
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    form.target = '_blank'; // This will open in new tab
    form.style.display = 'none';

    Object.keys(gatewayData).forEach((key) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = gatewayData[key];
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form); // Clean up
  },
};

export default paymentService;
