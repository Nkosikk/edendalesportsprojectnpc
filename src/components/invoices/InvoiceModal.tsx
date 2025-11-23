import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import Button from '../ui/Button';
import InvoiceGenerator from './InvoiceGenerator';
import { BookingDetails } from '../../types';
import { invoiceService } from '../../services/invoiceService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Download, Mail, FileText } from 'lucide-react';

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
  const { user } = useAuth();
  const [emailSending, setEmailSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emailData, setEmailData] = useState({
    recipient: booking.email,
    subject: `Invoice for Booking ${booking.booking_reference}`,
    message: `Dear ${booking.first_name},\n\nPlease find attached your invoice for the sports facility booking.\n\nBooking Details:\n- Field: ${booking.field_name}\n- Date: ${booking.booking_date}\n- Time: ${booking.start_time} - ${booking.end_time}\n\nThank you for choosing our facility.\n\nBest regards,\nEdendale Sports Complex`
  });

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

  const handleEmailInvoice = async () => {
    if (!user || user.role !== 'admin') {
      toast.error('Only administrators can send invoices via email');
      return;
    }

    try {
      setEmailSending(true);
      await invoiceService.emailInvoice({
        booking_id: booking.id,
        recipient_email: emailData.recipient,
        subject: emailData.subject,
        message: emailData.message,
        include_payment_link: booking.payment_status !== 'paid'
      });
      toast.success('Invoice sent successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invoice');
    } finally {
      setEmailSending(false);
    }
  };

  const validation = invoiceService.validateInvoiceData(booking);
  const invoiceTotals = invoiceService.calculateInvoiceTotals(booking.total_amount);
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
        <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
          <InvoiceGenerator 
            booking={booking}
            invoiceNumber={invoiceService.formatInvoiceNumber(booking.booking_reference)}
          />
        </div>

        {/* Invoice Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Invoice Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><span className="text-gray-600">Invoice #:</span> {invoiceService.formatInvoiceNumber(booking.booking_reference)}</p>
              <p><span className="text-gray-600">Status:</span> <span className={invoiceStatus.statusColor}>{invoiceStatus.statusText}</span></p>
              <p><span className="text-gray-600">Customer:</span> {booking.first_name} {booking.last_name}</p>
            </div>
            <div className="text-right">
              <p><span className="text-gray-600">Subtotal:</span> R{invoiceTotals.subtotal.toFixed(2)}</p>
              <p><span className="text-gray-600">VAT (15%):</span> R{invoiceTotals.vat.toFixed(2)}</p>
              <p className="font-medium"><span className="text-gray-600">Total:</span> R{invoiceTotals.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={handleDownload}
              loading={downloading}
              icon={Download}
              className="flex-1"
            >
              Download PDF
            </Button>
            
            {user?.role === 'admin' && (
              <Button
                onClick={() => {/* Toggle email form */}}
                variant="outline"
                icon={Mail}
                className="flex-1"
              >
                Send via Email
              </Button>
            )}
          </div>

          {/* Email Form (Admin Only) */}
          {user?.role === 'admin' && (
            <div className="border rounded-lg p-4 space-y-4">
              <h5 className="font-medium text-gray-900">Send Invoice via Email</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={emailData.recipient}
                    onChange={(e) => setEmailData(prev => ({ ...prev, recipient: e.target.value }))}
                    className="input w-full"
                    placeholder="customer@example.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={emailData.subject}
                    onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Message
                </label>
                <textarea
                  value={emailData.message}
                  onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="input w-full"
                  placeholder="Enter your email message..."
                />
              </div>

              <Button
                onClick={handleEmailInvoice}
                loading={emailSending}
                icon={Mail}
                className="w-full"
              >
                Send Invoice Email
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceModal;