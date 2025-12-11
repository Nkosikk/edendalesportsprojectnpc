import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import Button from '../ui/Button';
import InvoiceGenerator from './InvoiceGenerator';
import { BookingDetails } from '../../types';
import { invoiceService } from '../../services/invoiceService';

import toast from 'react-hot-toast';
import { Download, FileText, Send, Mail, LinkIcon, FileCheck } from 'lucide-react';
import { getRefundAdjustedAmount, getExplicitRefundAmount, formatCurrency } from '../../lib/utils';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetails;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  booking
}) => {

  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSubject, setEmailSubject] = useState(`Invoice for Booking ${booking?.booking_reference || ''}`);
  const [emailMessage, setEmailMessage] = useState('Please find attached your invoice for the booking. Thank you for choosing Edendale Sports!');
  const [includePaymentLink, setIncludePaymentLink] = useState(true);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await invoiceService.downloadInvoice(booking);
      toast.success('Invoice downloaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!booking?.id) {
      toast.error('Invalid booking');
      return;
    }
    
    try {
      setSending(true);
      await invoiceService.sendInvoice(booking.id, {
        recipient_email: booking.email,
        subject: emailSubject,
        message: emailMessage,
        include_payment_link: includePaymentLink && booking.payment_status !== 'paid',
      });
      toast.success('Invoice sent successfully!');
      setShowEmailForm(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  const handleQuickSend = async () => {
    if (!booking?.id) {
      toast.error('Invalid booking');
      return;
    }
    
    try {
      setSending(true);
      await invoiceService.sendInvoice(booking.id, {
        include_payment_link: booking.payment_status !== 'paid',
      });
      toast.success('Invoice sent successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };



  const validation = invoiceService.validateInvoiceData(booking);
  const adjustedAmount = getRefundAdjustedAmount(booking);
  const refundDue = getExplicitRefundAmount(booking);
  const invoiceTotals = invoiceService.calculateInvoiceTotals(Math.abs(adjustedAmount));
  const invoiceStatus = invoiceService.getInvoiceStatus(booking);

  if (!validation.isValid) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Invoice Generation Error">
        <div className="text-center py-6">
          <FileText className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Cannot Generate Invoice</h3>
          <div className="text-sm text-red-600 space-y-1">
            {validation.errors.map((error, index) => (
              <p key={index}>• {error}</p>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invoice" size="xl">
      <div className="space-y-6">
        {/* Invoice Preview */}
        <div className="border rounded-lg p-2 sm:p-4 max-h-[60vh] overflow-y-auto overflow-x-auto">
          <InvoiceGenerator 
            booking={booking}
            invoiceNumber={invoiceService.formatInvoiceNumber(booking?.booking_reference)}
          />
        </div>

        {/* Invoice Summary */}
        <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Invoice Summary</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div>
              <p><span className="text-gray-600">Invoice #:</span> {invoiceService.formatInvoiceNumber(booking?.booking_reference)}</p>
              <p><span className="text-gray-600">Status:</span> <span className={invoiceStatus.statusColor}>{invoiceStatus.statusText}</span></p>
              <p><span className="text-gray-600">Customer:</span> {booking?.first_name || ''} {booking?.last_name || ''}</p>
            </div>
            <div className="text-left sm:text-right">
              <p><span className="text-gray-600">Subtotal:</span> R{(invoiceTotals.subtotal || 0).toFixed(2)}</p>
              <p><span className="text-gray-600">VAT (0%):</span> R{(invoiceTotals.vat || 0).toFixed(2)}</p>
              <p className="font-medium"><span className="text-gray-600">Total:</span> R{(invoiceTotals.total || 0).toFixed(2)}</p>
              {adjustedAmount < 0 && (
                <p className="text-xs font-semibold text-red-600 mt-1">
                  Refund owed {refundDue ? `(${formatCurrency(refundDue)})` : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Email Form (Expandable) */}
        {showEmailForm && (
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span>Send Invoice via Email</span>
            </h4>
            <div className="space-y-3">
              {/* Recipient Email */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={booking?.email || ''}
                  disabled
                  className="input w-full bg-gray-100 text-sm"
                />
              </div>
              
              {/* Subject */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="input w-full text-sm"
                  placeholder="Email subject..."
                />
              </div>
              
              {/* Message */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  className="input w-full text-sm"
                  rows={2}
                  placeholder="Add a message..."
                />
              </div>

              {/* What will be sent info */}
              <div className="bg-white p-2 sm:p-3 rounded border border-blue-100">
                <p className="text-xs font-medium text-gray-700 mb-2">Email will include:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <FileCheck className="h-3 w-3 text-green-600 flex-shrink-0" />
                    <span>Invoice PDF attachment</span>
                  </div>
                  {booking?.payment_status !== 'paid' && (
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="includePaymentLinkModal"
                        checked={includePaymentLink}
                        onChange={(e) => setIncludePaymentLink(e.target.checked)}
                        className="h-3 w-3 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                      />
                      <label htmlFor="includePaymentLinkModal" className="text-xs text-gray-600 leading-tight">
                        <span className="flex items-center gap-1">
                          <LinkIcon className="h-3 w-3 text-blue-600" />
                          Payment link (generated by server)
                        </span>
                      </label>
                    </div>
                  )}
                  {booking?.payment_status === 'paid' && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <span className="w-3 h-3 flex items-center justify-center">✓</span>
                      <span>Payment already received</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons - Mobile optimized */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailForm(false)}
                  disabled={sending}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendInvoice}
                  loading={sending}
                  icon={Send}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Send Invoice
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Actions - Mobile optimized */}
        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
          <Button
            onClick={handleDownload}
            loading={downloading}
            icon={Download}
            className="w-full sm:w-auto px-4 sm:px-6"
            size="sm"
          >
            Download PDF
          </Button>
          {!showEmailForm && (
            <>
              <Button
                onClick={handleQuickSend}
                loading={sending}
                icon={Send}
                variant="outline"
                className="w-full sm:w-auto px-4 sm:px-6"
                size="sm"
              >
                Email Invoice
              </Button>
              {/* Hidden until backend is implemented
              <Button
                onClick={() => setShowEmailForm(true)}
                icon={Mail}
                variant="secondary"
                className="w-full sm:w-auto px-4 sm:px-6"
                size="sm"
              >
                Customize & Send
              </Button>
              */}
            </>
          )}
        </div>
        <p className="text-xs text-gray-500 text-center">
          Invoice will be sent to: <span className="font-medium break-all">{booking?.email || 'N/A'}</span>
        </p>
      </div>
    </Modal>
  );
};

export default InvoiceModal;