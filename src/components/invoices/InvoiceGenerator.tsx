import React from 'react';
import { BookingDetails } from '../../types';
import {
  formatCurrency,
  formatDate,
  formatTime,
} from '../../lib/utils';
import { invoiceService } from '../../services/invoiceService';

interface InvoiceData extends BookingDetails {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  payment_method?: 'online' | 'eft' | 'cash' | 'card';
  companyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
  };
}

interface InvoiceGeneratorProps {
  booking: BookingDetails;
  invoiceNumber?: string;
  companyInfo?: Partial<InvoiceData['companyInfo']>;
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ 
  booking, 
  invoiceNumber,
  companyInfo 
}) => {
  const defaultCompanyInfo = {
    name: 'Edendale Sports Complex',
    address: '123 Sports Avenue, Edendale, Pietermaritzburg, 3201',
    phone: '065 883 4116',
    email: 'admin@edendalesports.co.za',
    website: 'www.edendalesports.co.za',
    ...companyInfo
  };

  const invoiceData: InvoiceData = {
    ...booking,
    invoiceNumber: invoiceNumber || `INV-${booking.booking_reference}`,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: booking.status === 'pending' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
    companyInfo: defaultCompanyInfo
  };
  const displayAmount = booking.total_amount || 0;
  const invoiceTotals = invoiceService.calculateInvoiceTotals(displayAmount, 0);
  const paymentStatusMap: Record<string, { label: string; dotClass: 'paid' | 'pending' | 'unpaid'; textClass: 'paid' | 'pending' | 'unpaid'; cardModifier?: 'status-paid' | 'status-pending' | 'status-unpaid'; }> = {
    paid: { label: 'PAID', dotClass: 'paid', textClass: 'paid', cardModifier: 'status-paid' },
    pending: { label: 'PAYMENT DUE', dotClass: 'pending', textClass: 'pending', cardModifier: 'status-pending' },
    unpaid: { label: 'UNPAID', dotClass: 'unpaid', textClass: 'unpaid', cardModifier: 'status-unpaid' },
    cancelled: { label: 'CANCELLED', dotClass: 'unpaid', textClass: 'unpaid', cardModifier: 'status-unpaid' },
    refunded: { label: 'REFUNDED', dotClass: 'paid', textClass: 'paid', cardModifier: 'status-paid' }
  };
  const paymentStatusKey = (invoiceData.payment_status || 'pending').toLowerCase();
  const paymentStatus = paymentStatusMap[paymentStatusKey] || paymentStatusMap.pending;
  const paymentStatusCardClass = paymentStatus.cardModifier ? ` ${paymentStatus.cardModifier}` : '';

  return (
    <div className="w-full min-w-[280px] mx-auto bg-white p-2 shadow-lg invoice-container" id="invoice-content">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-2 pb-1 border-b-2 border-primary-500 invoice-header gap-2">
        <div className="flex items-center space-x-1 invoice-header-left">
          {/* Logo */}
          <div className="flex-shrink-0">
            <img 
              src="/images/ESP-BLUE-2.png" 
              alt="Edendale Sports Complex Logo"
              className="w-5 h-5 object-contain invoice-logo"
            />
          </div>
          {/* Company Info */}
          <div className="invoice-company">
            <h1 className="text-xs sm:text-sm font-bold text-gray-900 invoice-company-name">{invoiceData.companyInfo.name}</h1>
            <div className="text-[10px] sm:text-xs text-gray-600 invoice-company-meta hidden sm:block">
              <p>{invoiceData.companyInfo.address} • {invoiceData.companyInfo.phone} • {invoiceData.companyInfo.email}</p>
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right invoice-header-right w-full sm:w-auto">
          <div className="bg-primary-50 px-2 py-0 rounded invoice-badge inline-block">
            <h2 className="text-sm font-bold text-primary-700 invoice-header-title">INVOICE</h2>
          </div>
          <div className="text-[10px] sm:text-xs text-gray-600 mt-0 invoice-header-meta">
            <p><span className="font-semibold">Invoice #:</span> {invoiceData.invoiceNumber}</p>
            <p><span className="font-semibold">Date:</span> {formatDate(invoiceData.issueDate)}</p>
            <p><span className="font-semibold">Ref:</span> {invoiceData.booking_reference}</p>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-1 invoice-section invoice-section-billto">
        <h3 className="text-xs font-semibold text-gray-900 mb-0 text-primary-700 invoice-section-title">Bill To:</h3>
        <div className="bg-gray-50 p-1 rounded text-xs invoice-section-body">
          <p className="font-semibold text-gray-900">{invoiceData.first_name} {invoiceData.last_name}</p>
          <p className="text-gray-600">{invoiceData.email}{invoiceData.phone && ` • ${invoiceData.phone}`}</p>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="mb-1 invoice-section invoice-details-section">
        <h3 className="text-xs font-semibold text-primary-700 mb-0 invoice-section-title">Booking Details</h3>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full border-collapse bg-white shadow-sm rounded overflow-hidden text-[10px] sm:text-xs invoice-table min-w-[300px]">
            <thead>
              <tr className="bg-primary-600 text-white">
                <th className="px-1 py-0.5 text-left font-semibold">Name</th>
                <th className="px-1 py-0.5 text-center font-semibold hidden sm:table-cell">Date</th>
                <th className="px-1 py-0.5 text-center font-semibold">Time</th>
                <th className="px-1 py-0.5 text-center font-semibold">Hrs</th>
                <th className="px-1 py-0.5 text-right font-semibold">Rate</th>
                <th className="px-1 py-0.5 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-1 py-0.5">
                  <div className="font-semibold text-gray-900 truncate max-w-[80px] sm:max-w-none">{invoiceData.field_name}</div>
                  <div className="text-[9px] sm:text-xs text-gray-600 capitalize">
                    {invoiceData.sport_type ? invoiceData.sport_type.replace('_', ' ') : 'N/A'}
                  </div>
                  <div className="text-[9px] text-gray-500 sm:hidden">
                    {formatDate(invoiceData.booking_date)}
                  </div>
                </td>
                <td className="px-1 py-0.5 text-center text-gray-900 hidden sm:table-cell">
                  {formatDate(invoiceData.booking_date)}
                </td>
                <td className="px-1 py-0.5 text-center text-gray-900">
                  <div className="font-medium text-[10px] sm:text-xs">{formatTime(invoiceData.start_time)}</div>
                  <div className="text-[9px] sm:text-xs text-gray-600">- {formatTime(invoiceData.end_time)}</div>
                </td>
                <td className="px-1 py-0.5 text-center font-semibold text-gray-900">
                  {invoiceData.duration_hours}
                </td>
                <td className="px-1 py-0.5 text-right text-gray-900 whitespace-nowrap">
                  {formatCurrency(invoiceData.hourly_rate)}
                </td>
                <td className="px-1 py-0.5 text-right font-bold text-primary-700 whitespace-nowrap">
                  {formatCurrency(displayAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-1 invoice-totals">
        <div className="w-40 bg-gray-50 p-1 rounded text-xs invoice-totals-box">
          <div className="space-y-0">
            <div className="flex justify-between text-gray-700 invoice-totals-row">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(invoiceTotals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-700 invoice-totals-row">
              <span>VAT (0%):</span>
              <span className="font-medium">{formatCurrency(invoiceTotals.vat)}</span>
            </div>
            <div className="border-t border-gray-300 pt-0 mt-0">
              <div className="flex justify-between text-xs font-bold text-gray-900 invoice-totals-total">
                <span>Total:</span>
                <span className="text-primary-700">{formatCurrency(invoiceTotals.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div className="grid grid-cols-1 gap-1 mb-1 invoice-payment">
        {/* Payment Status */}
        <div className={`bg-white border border-gray-200 rounded p-1 invoice-payment-card payment-status-card${paymentStatusCardClass}`}>
          <h4 className="font-semibold text-gray-900 mb-0 text-xs">Payment Status</h4>
          <div className="payment-status-chip">
            <span className={`payment-status-dot ${paymentStatus.dotClass}`}></span>
            <span className={`payment-status-text ${paymentStatus.textClass}`}>{paymentStatus.label}</span>
            {invoiceData.payment_method && (
              <span className="payment-method">• Method: <span className="capitalize">{invoiceData.payment_method}</span></span>
            )}
          </div>
        </div>

        {/* Payment Instructions or Notice */}
        {invoiceData.status === 'cancelled' ? (
          <div className="invoice-payment-card bg-gray-100 border border-gray-300 rounded p-1">
            <h4 className="font-semibold mb-0 text-xs text-gray-700">Booking Cancelled</h4>
            <p className="text-xs text-gray-600">
              This booking has been cancelled. <span className="font-semibold">No refunds are available.</span>
            </p>
          </div>
        ) : invoiceData.payment_status !== 'paid' ? (
          <div className="invoice-payment-card payment-instructions-card">
            <h4 className="font-semibold mb-0 text-xs">Payment Options</h4>
            <p className="text-xs">
              <span className="font-semibold">Online:</span> {invoiceData.booking_reference} • <span className="font-semibold">Bank:</span> 123456789 • <span className="font-semibold">Cash/Card</span> at reception
            </p>
          </div>
        ) : (
          <div className="invoice-payment-card payment-complete-card">
            <h4 className="font-semibold mb-0 text-xs">Payment Complete</h4>
            <p className="text-xs">
              Payment processed successfully.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center border-t border-gray-200 pt-1 invoice-footer">
        <p className="text-gray-500 text-[9px] mb-0.5">All payments are final. No refunds or cancellation credits are available.</p>
        <p className="text-primary-900 font-medium text-xs">Thank you for choosing {invoiceData.companyInfo.name}!</p>
      </div>
    </div>
  );
};

export default InvoiceGenerator;