import { BookingDetails } from '../types';
import { apiClient, handleApiResponse } from '../lib/api';
import { safeNumber } from '../lib/utils';

export interface EmailInvoiceRequest {
  booking_id: number;
  recipient_email?: string;
  subject?: string;
  message?: string;
  include_payment_link?: boolean;
}

export interface InvoiceEmailResponse {
  success: boolean;
  message: string;
  email_id?: string;
}

class InvoiceService {
  /**
   * Generate and download PDF invoice using browser print
   */
  async downloadInvoice(booking: BookingDetails, _filename?: string): Promise<void> {
    try {
      const element = document.getElementById('invoice-content');
      if (!element) {
        throw new Error('Invoice content not found. Make sure InvoiceGenerator component is rendered.');
      }

      // Create a new window with the invoice content
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Please allow popups to download invoice');
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice ${booking.booking_reference}</title>
            <style>
              @media print {
                body { margin: 0; font-family: Arial, sans-serif; }
                .no-print { display: none !important; }
              }
              ${this.getInvoiceStyles()}
            </style>
          </head>
          <body>
            ${element.innerHTML}
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
      }, 500);
    } catch (error: any) {
      throw new Error(`Invoice download failed: ${error.message}`);
    }
  }

  /**
   * Get CSS styles for invoice printing
   */
  private getInvoiceStyles(): string {
    return `
      body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
      .max-w-4xl { max-width: none; }
      .mx-auto { margin: 0; }
      .shadow-lg { box-shadow: none; }
      table { border-collapse: collapse; width: 100%; margin: 20px 0; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f5f5f5; font-weight: bold; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .font-bold { font-weight: bold; }
      .text-lg { font-size: 1.125em; }
      .text-xl { font-size: 1.25em; }
      .text-2xl { font-size: 1.5em; }
      .text-3xl { font-size: 1.875em; }
      .mb-2 { margin-bottom: 8px; }
      .mb-4 { margin-bottom: 16px; }
      .mb-8 { margin-bottom: 32px; }
      .mt-2 { margin-top: 8px; }
      .p-4 { padding: 16px; }
      .px-4 { padding-left: 16px; padding-right: 16px; }
      .py-2 { padding-top: 8px; padding-bottom: 8px; }
      .border { border: 1px solid #ddd; }
      .rounded { border-radius: 4px; }
      .bg-gray-50 { background-color: #f9f9f9; }
      .bg-blue-50 { background-color: #eff6ff; }
      .text-gray-600 { color: #666; }
      .text-gray-700 { color: #555; }
      .text-primary-600 { color: #2563eb; }
      .bg-primary-600 { background-color: #2563eb; }
      .text-white { color: white; }
      .flex { display: flex; }
      .items-center { align-items: center; }
      .items-start { align-items: flex-start; }
      .justify-center { justify-content: center; }
      .justify-between { justify-content: space-between; }
      .space-x-4 > * + * { margin-left: 16px; }
      .flex-shrink-0 { flex-shrink: 0; }
      .w-16 { width: 64px; }
      .h-16 { height: 64px; }
      .rounded-lg { border-radius: 8px; }
      .object-contain { object-fit: contain; }
      img { max-width: 100%; height: auto; }
    `;
  }

  /**
   * Send invoice via email (Admin only)
   */
  async emailInvoice(request: EmailInvoiceRequest): Promise<InvoiceEmailResponse> {
    try {
      const response = await apiClient.post<{ data: InvoiceEmailResponse }>('/admin/email-invoice', {
        booking_id: request.booking_id,
        recipient_email: request.recipient_email,
        subject: request.subject || 'Your Sports Facility Booking Invoice',
        message: request.message || 'Please find attached your booking invoice. Thank you for choosing our facility.',
        include_payment_link: request.include_payment_link !== false, // default true
      });

      return handleApiResponse<InvoiceEmailResponse>(response, true);
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || 'Failed to send invoice email');
    }
  }

  /**
   * Generate invoice preview URL for email
   */
  generateInvoicePreviewUrl(bookingId: number): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/app/invoices/${bookingId}`;
  }

  /**
   * Validate invoice data
   */
  validateInvoiceData(booking: BookingDetails): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!booking.booking_reference) errors.push('Booking reference is required');
    if (!booking.field_name) errors.push('Field name is required');
    if (!booking.first_name || !booking.last_name) errors.push('Customer name is required');
    if (!booking.email) errors.push('Customer email is required');
    if (!booking.booking_date) errors.push('Booking date is required');
    if (!booking.start_time || !booking.end_time) errors.push('Booking time is required');
    if (!booking.total_amount || booking.total_amount <= 0) errors.push('Valid booking amount is required');

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format invoice number
   */
  formatInvoiceNumber(bookingReference: string | null | undefined, customPrefix?: string): string {
    const prefix = customPrefix || 'INV';
    const timestamp = new Date().getFullYear().toString().slice(-2) + 
                     (new Date().getMonth() + 1).toString().padStart(2, '0');
    const ref = bookingReference || 'UNKNOWN';
    return `${prefix}-${timestamp}-${ref}`;
  }

  /**
   * Calculate invoice totals including VAT
   */
  calculateInvoiceTotals(totalAmount: number | null | undefined, vatRate: number = 0.15) {
    const subtotal = safeNumber(totalAmount);
    const vat = subtotal * vatRate;
    const total = subtotal + vat;

    return {
      subtotal: safeNumber(subtotal.toFixed(2)),
      vat: safeNumber(vat.toFixed(2)),
      vatRate,
      total: safeNumber(total.toFixed(2)),
      totalExclVat: safeNumber(subtotal.toFixed(2)),
      totalInclVat: safeNumber(total.toFixed(2))
    };
  }

  /**
   * Get invoice status based on booking and payment status
   */
  getInvoiceStatus(booking: BookingDetails): {
    status: 'paid' | 'pending' | 'overdue' | 'cancelled';
    statusText: string;
    statusColor: string;
  } {
    if (booking.status === 'cancelled') {
      return {
        status: 'cancelled',
        statusText: 'Cancelled',
        statusColor: 'text-gray-600'
      };
    }

    if (booking.payment_status === 'paid') {
      return {
        status: 'paid',
        statusText: 'Paid',
        statusColor: 'text-green-600'
      };
    }

    if (booking.payment_status === 'pending') {
      const bookingDate = new Date(booking.booking_date);
      const today = new Date();
      
      if (bookingDate < today) {
        return {
          status: 'overdue',
          statusText: 'Overdue',
          statusColor: 'text-red-600'
        };
      }

      return {
        status: 'pending',
        statusText: 'Payment Due',
        statusColor: 'text-yellow-600'
      };
    }

    return {
      status: 'pending',
      statusText: 'Payment Required',
      statusColor: 'text-yellow-600'
    };
  }
}

export const invoiceService = new InvoiceService();