import React from 'react';
import { BookingDetails } from '../../types';
import { formatCurrency, formatDate, formatTime } from '../../lib/utils';

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
    phone: '+27 33 123 4567',
    email: 'bookings@edendalesports.co.za',
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

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg" id="invoice-content">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-start space-x-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <img 
              src="/images/ESP-BLUE-2.png" 
              alt="Edendale Sports Complex Logo"
              className="w-16 h-16 object-contain"
            />
          </div>
          {/* Company Info */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{invoiceData.companyInfo.name}</h1>
            <div className="text-sm text-gray-600 mt-2">
              <p>{invoiceData.companyInfo.address}</p>
              <p>Phone: {invoiceData.companyInfo.phone}</p>
              <p>Email: {invoiceData.companyInfo.email}</p>
              {invoiceData.companyInfo.website && <p>Web: {invoiceData.companyInfo.website}</p>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-primary-600">INVOICE</h2>
          <div className="text-sm text-gray-600 mt-2">
            <p><span className="font-medium">Invoice #:</span> {invoiceData.invoiceNumber}</p>
            <p><span className="font-medium">Issue Date:</span> {formatDate(invoiceData.issueDate)}</p>
            {invoiceData.dueDate && (
              <p><span className="font-medium">Due Date:</span> {formatDate(invoiceData.dueDate)}</p>
            )}
            <p><span className="font-medium">Booking Ref:</span> {invoiceData.booking_reference}</p>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Bill To:</h3>
        <div className="text-sm text-gray-700">
          <p className="font-medium">{invoiceData.first_name} {invoiceData.last_name}</p>
          <p>{invoiceData.email}</p>
          {invoiceData.phone && <p>{invoiceData.phone}</p>}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="mb-8">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Date</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Time</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Duration</th>
              <th className="border border-gray-300 px-4 py-2 text-right">Rate/Hour</th>
              <th className="border border-gray-300 px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2">
                <div className="font-medium">{invoiceData.field_name}</div>
                <div className="text-xs text-gray-600 capitalize">
                  {invoiceData.sport_type.replace('_', ' ')} Field Booking
                </div>
                {invoiceData.notes && (
                  <div className="text-xs text-gray-600 mt-1">
                    <strong>Notes:</strong> {invoiceData.notes}
                  </div>
                )}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {formatDate(invoiceData.booking_date)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {formatTime(invoiceData.start_time)} - {formatTime(invoiceData.end_time)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {invoiceData.duration_hours}h
              </td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                {formatCurrency(invoiceData.hourly_rate)}
              </td>
              <td className="border border-gray-300 px-4 py-2 text-right">
                {formatCurrency(invoiceData.total_amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-2 border-b border-gray-300">
            <span className="font-medium">Subtotal:</span>
            <span>{formatCurrency(invoiceData.total_amount)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-300">
            <span className="font-medium">VAT (15%):</span>
            <span>{formatCurrency(invoiceData.total_amount * 0.15)}</span>
          </div>
          <div className="flex justify-between py-3 text-lg font-bold border-b-2 border-gray-900">
            <span>Total:</span>
            <span>{formatCurrency(invoiceData.total_amount * 1.15)}</span>
          </div>
        </div>
      </div>

      {/* Payment Status */}
      <div className="mb-8">
        <div className="flex items-center justify-between bg-gray-50 p-4 rounded">
          <div>
            <h4 className="font-semibold text-gray-900">Payment Status</h4>
            <p className="text-sm text-gray-600">
              Status: <span className={`font-medium ${
                invoiceData.payment_status === 'paid' ? 'text-green-600' :
                invoiceData.payment_status === 'pending' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {invoiceData.payment_status?.toUpperCase() || 'PENDING'}
              </span>
            </p>
            {invoiceData.payment_method && (
              <p className="text-sm text-gray-600">
                Method: <span className="font-medium">{invoiceData.payment_method.toUpperCase()}</span>
              </p>
            )}
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            invoiceData.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
            invoiceData.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {invoiceData.payment_status === 'paid' ? 'PAID' : 
             invoiceData.payment_status === 'pending' ? 'PAYMENT DUE' : 'UNPAID'}
          </div>
        </div>
      </div>

      {/* Payment Instructions */}
      {invoiceData.payment_status !== 'paid' && (
        <div className="mb-8 bg-blue-50 p-4 rounded">
          <h4 className="font-semibold text-gray-900 mb-2">Payment Instructions</h4>
          <div className="text-sm text-gray-700 space-y-1">
            <p><strong>Online Payment:</strong> Visit our website and use booking reference: {invoiceData.booking_reference}</p>
            <p><strong>Bank Transfer:</strong> Standard Bank - Account: 123456789 - Reference: {invoiceData.booking_reference}</p>
            <p><strong>Cash/Card:</strong> Pay at reception during facility operating hours</p>
            <p className="text-xs mt-2 text-gray-600">
              Please include your booking reference ({invoiceData.booking_reference}) with all payments.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 border-t border-gray-200 pt-4">
        <p>Thank you for choosing {invoiceData.companyInfo.name}</p>
        <p>For any queries regarding this invoice, please contact us at {invoiceData.companyInfo.email}</p>
        <p className="mt-2">Generated on {formatDate(new Date().toISOString().split('T')[0])}</p>
      </div>
    </div>
  );
};

export default InvoiceGenerator;