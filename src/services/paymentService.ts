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
    const response = await apiClient.get<ApiResponse<PaymentStatus>>('/payments/status', {
      params: {
        payment_reference: paymentReference,
        booking_id: bookingId,
      },
    });
    return handleApiResponse<PaymentStatus>(response);
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

    // Create a form and submit it to PayFast
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;

    Object.keys(gatewayData).forEach((key) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = gatewayData[key];
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  },
};

export default paymentService;
