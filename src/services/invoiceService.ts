import { BookingDetails } from '../types';
import { safeNumber } from '../lib/utils';



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
      @page {
        size: A4;
        margin: 12mm;
      }
      *, *::before, *::after { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; color: #1f2937; font-size: 12px; line-height: 1.45; background: #f3f4f6; }
      #invoice-content { page-break-inside: avoid; }
      .invoice-container { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px; }
      .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
      .invoice-header-left { display: flex; align-items: center; gap: 12px; }
      .invoice-logo { width: 90px; height: auto; object-fit: contain; }
      .invoice-company-name { margin: 0; font-size: 20px; color: #0f172a; }
      .invoice-company-meta { margin: 4px 0 0; color: #4b5563; font-size: 12px; line-height: 1.4; }
      .invoice-header-right { text-align: right; font-size: 12px; color: #4b5563; }
      .invoice-badge { display: inline-block; background: #eff6ff; border-radius: 8px; padding: 6px 12px; margin-bottom: 8px; }
      .invoice-header-title { margin: 0; font-size: 18px; letter-spacing: 0.08em; }
      .invoice-header-meta p { margin: 2px 0; }
      .invoice-section { margin-bottom: 16px; page-break-inside: avoid; }
      .invoice-section-title { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: #1d4ed8; }
      .invoice-section-body { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 12px; }
      .invoice-table { width: 100%; border-collapse: collapse; margin: 0; font-size: 12px; }
      .invoice-table thead { background: #1d4ed8; color: #ffffff; }
      .invoice-table th, .invoice-table td { padding: 6px 8px; border: 1px solid #e5e7eb; text-align: left; }
      .invoice-table th { font-weight: 600; }
      .invoice-table td { vertical-align: top; }
      .invoice-totals { display: flex; justify-content: flex-end; margin: 12px 0 16px; }
      .invoice-totals-box { width: 220px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; }
      .invoice-totals-row { display: flex; justify-content: space-between; margin-bottom: 4px; color: #4b5563; }
      .invoice-totals-total { display: flex; justify-content: space-between; border-top: 1px solid #d1d5db; padding-top: 6px; margin-top: 6px; font-size: 13px; font-weight: 700; color: #111827; }
      .invoice-payment { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
      .invoice-payment-card { background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 12px; line-height: 1.45; page-break-inside: avoid; }
      .payment-status-card { display: flex; flex-direction: column; gap: 6px; }
      .payment-status-chip { display: flex; align-items: center; gap: 6px; font-weight: 600; }
      .payment-status-dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
      .payment-status-dot.paid { background: #16a34a; }
      .payment-status-dot.pending { background: #ca8a04; }
      .payment-status-dot.unpaid { background: #dc2626; }
      .payment-status-text.paid { color: #15803d; }
      .payment-status-text.pending { color: #a16207; }
      .payment-status-text.unpaid { color: #b91c1c; }
      .payment-status-card.status-paid { background: #ecfdf5; border-color: #bbf7d0; }
      .payment-status-card.status-pending { background: #fffbeb; border-color: #fde68a; }
      .payment-status-card.status-unpaid { background: #fef2f2; border-color: #fecaca; }
      .refund-card { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
      .payment-instructions-card { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
      .payment-complete-card { background: #ecfdf5; border-color: #bbf7d0; color: #047857; }
      .invoice-footer { border-top: 1px solid #d1d5db; padding-top: 8px; text-align: center; font-size: 11px; color: #4b5563; }
      .invoice-footer strong { color: #1d4ed8; }
      .refund-card p,
      .payment-instructions-card p,
      .payment-complete-card p { margin: 0; }
      .invoice-payment-card h4 { margin: 0; font-size: 12px; font-weight: 600; color: #111827; }
      @media print and (max-width: 720px) {
        .invoice-payment { grid-template-columns: 1fr; }
      }
      img { max-width: 100%; height: auto; }
    `;
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
  calculateInvoiceTotals(totalAmount: number | null | undefined, vatRate: number = 0) {
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

    if (booking.payment_status === 'refunded') {
      return {
        status: 'cancelled',
        statusText: 'Refunded',
        statusColor: 'text-purple-600'
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