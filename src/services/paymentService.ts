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
    const response = await apiClient.post<ApiResponse<PaymentResponse>>('/payments/process', data);
    return handleApiResponse<PaymentResponse>(response);
  },

  /**
   * Confirm manual payment (Staff/Admin only)
   */
  confirmPayment: async (paymentId?: number, bookingId?: number): Promise<void> => {
    const response = await apiClient.post<ApiResponse>(
      '/payments/confirm',
      {
        payment_id: paymentId,
        booking_id: bookingId,
      },
      {
        suppressErrorToast: true,
      } as any
    );
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
    // Debug: Log environment variables
    console.log('PayFast Mode:', import.meta.env.VITE_PAYFAST_MODE);
    console.log('Merchant ID:', import.meta.env.VITE_PAYFAST_MERCHANT_ID);
    console.log('Merchant Key:', import.meta.env.VITE_PAYFAST_MERCHANT_KEY);
    console.log('Original Gateway Data from Backend:', gatewayData);

    // Get PayFast configuration based on mode
    const mode = import.meta.env.VITE_PAYFAST_MODE || 'auto';
    const sandboxUrl = import.meta.env.VITE_PAYFAST_SANDBOX_URL || 'https://sandbox.payfast.co.za/eng/process';
    const liveUrl = import.meta.env.VITE_PAYFAST_LIVE_URL || 'https://www.payfast.co.za/eng/process';
    
    console.log('PayFast Mode:', mode);
    console.log('Original Backend Data:', gatewayData);
    
    // Only override when in LIVE mode (let backend handle sandbox naturally)
    if (mode === 'live') {
      const liveMerchantId = import.meta.env.VITE_PAYFAST_LIVE_MERCHANT_ID;
      const liveMerchantKey = import.meta.env.VITE_PAYFAST_LIVE_MERCHANT_KEY;
      
      if (liveMerchantId && liveMerchantKey) {
        gatewayData.merchant_id = liveMerchantId;
        gatewayData.merchant_key = liveMerchantKey;
        console.log('🔴 LIVE MODE: Overriding with production credentials');
        console.log('Merchant ID:', liveMerchantId);
        console.log('Merchant Key:', liveMerchantKey.substring(0, 6) + '...');
      }
    } else if (mode === 'sandbox') {
      console.log('🟡 SANDBOX MODE: Using backend credentials (no override)');
      console.log('Backend Merchant ID:', gatewayData.merchant_id);
      console.log('Backend Merchant Key:', gatewayData.merchant_key?.substring(0, 6) + '...');
    }

    // Determine PayFast URL based on mode
    const resolveGatewayUrl = () => {
      if (mode === 'live') {
        console.log('🔴 Using LIVE URL:', liveUrl);
        return liveUrl;
      } else if (mode === 'sandbox') {
        console.log('🟡 Using SANDBOX URL:', sandboxUrl);
        return sandboxUrl;
      }
      // If mode is 'auto', use backend provided URL as fallback
      console.log('⚪ Auto mode - using backend URL:', gatewayUrl);
      return gatewayUrl || liveUrl;
    };

    const actionUrl = resolveGatewayUrl();
    console.log('Final PayFast URL:', actionUrl);
    console.log('Final Gateway Data:', gatewayData);

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
