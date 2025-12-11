import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowLeft, Download, Send, Mail, LinkIcon, FileCheck } from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { invoiceService } from '../../services/invoiceService';
import InvoiceGenerator from '../../components/invoices/InvoiceGenerator';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { BookingDetails } from '../../types';

const InvoicePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const [sending, setSending] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('Please find attached your invoice for the booking. Thank you for choosing Edendale Sports!');
  const [includePaymentLink, setIncludePaymentLink] = useState(true);

  const { data: booking, isLoading, error } = useQuery<BookingDetails>(
    ['booking', bookingId],
    () => bookingService.getBookingById(bookingId),
    { 
      enabled: !!id && !isNaN(bookingId) && bookingId > 0,
      retry: 1,
      onSuccess: (data) => {
        // Set default email subject once booking data is available
        if (data?.booking_reference && !emailSubject) {
          setEmailSubject(`Invoice for Booking ${data.booking_reference}`);
        }
      }
    }
  );

  const handleDownload = async () => {
    if (!booking) return;
    try {
      await invoiceService.downloadInvoice(booking);
      toast.success('Invoice downloaded successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download invoice');
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

  // Invalid booking ID
  if (!id || isNaN(bookingId) || bookingId <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6 text-center">
          <p className="text-error-600 mb-4">Invalid booking ID in URL.</p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6 text-center">
          <p className="text-error-600 mb-4">
            {error ? 'Failed to load invoice.' : 'Booking not found.'}
          </p>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const validation = invoiceService.validateInvoiceData(booking);
  if (!validation.isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Invoice Generation Error</h2>
          <div className="text-sm text-red-600 space-y-1 mb-4">
            {validation.errors.map((error, index) => (
              <p key={index}>• {error}</p>
            ))}
          </div>
          <Link to="/app/bookings">
            <Button variant="outline" icon={ArrowLeft}>Back to Bookings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link to="/app/bookings" className="flex-shrink-0">
              <Button variant="outline" size="sm" icon={ArrowLeft}>Back</Button>
            </Link>
            <h1 className="text-base sm:text-2xl font-bold text-gray-900 truncate">
              Invoice - {invoiceService.formatInvoiceNumber(booking.booking_reference)}
            </h1>
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            <Button onClick={handleDownload} icon={Download} size="sm">
              Download
            </Button>
            <Button 
              onClick={handleQuickSend} 
              icon={Send} 
              size="sm" 
              variant="outline"
              loading={sending && !showEmailForm}
            >
              Email Invoice
            </Button>
            {/* Hidden until backend is implemented
            <Button 
              onClick={() => setShowEmailForm(!showEmailForm)} 
              icon={Mail} 
              size="sm" 
              variant="secondary"
            >
              {showEmailForm ? 'Hide Form' : 'Customize'}
            </Button>
            */}
          </div>
        </div>

        {/* Email Customization Form - Mobile Optimized */}
        {showEmailForm && (
          <div className="mb-4 sm:mb-6 bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-200">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span>Send Invoice via Email</span>
            </h3>
            <div className="space-y-3">
              {/* Recipient */}
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
                        id="includePaymentLinkPage"
                        checked={includePaymentLink}
                        onChange={(e) => setIncludePaymentLink(e.target.checked)}
                        className="h-3 w-3 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                      />
                      <label htmlFor="includePaymentLinkPage" className="text-xs text-gray-600 leading-tight">
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

        {/* Invoice Content */}
        <div className="bg-white shadow-lg rounded-lg">
          <InvoiceGenerator 
            booking={booking}
            invoiceNumber={invoiceService.formatInvoiceNumber(booking.booking_reference)}
          />
        </div>

        {/* Print Instructions */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>To print this invoice, use your browser's print function (Ctrl+P / Cmd+P)</p>
          <p className="mt-1">Invoice will be sent to: <span className="font-medium">{booking?.email}</span></p>
        </div>
      </div>
    </div>
  );
};

export default InvoicePage;