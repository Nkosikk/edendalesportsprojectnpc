import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowLeft, Download, Mail } from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { invoiceService } from '../../services/invoiceService';
import InvoiceGenerator from '../../components/invoices/InvoiceGenerator';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { BookingDetails } from '../../types';

const InvoicePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const { user } = useAuth();

  const { data: booking, isLoading, error } = useQuery<BookingDetails>(
    ['booking', bookingId],
    () => bookingService.getBookingById(bookingId),
    { 
      enabled: !!id && !isNaN(bookingId) && bookingId > 0,
      retry: 1
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

  const handleEmailInvoice = async () => {
    if (!booking || !user || user.role !== 'admin') {
      toast.error('Only administrators can send invoices via email');
      return;
    }

    try {
      toast('Invoice emailing is coming soon.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invoice');
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app/bookings">
              <Button variant="outline" size="sm" icon={ArrowLeft}>Back</Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Invoice - {invoiceService.formatInvoiceNumber(booking.booking_reference)}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDownload} icon={Download} size="sm">
              Download
            </Button>
            {user?.role === 'admin' && (
              <Button onClick={handleEmailInvoice} variant="outline" icon={Mail} size="sm">
                Email
              </Button>
            )}
          </div>
        </div>

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
        </div>
      </div>
    </div>
  );
};

export default InvoicePage;