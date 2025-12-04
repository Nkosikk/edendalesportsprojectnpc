import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import Button from '../ui/Button';
import InvoiceGenerator from './InvoiceGenerator';
import { BookingDetails } from '../../types';
import { invoiceService } from '../../services/invoiceService';

import toast from 'react-hot-toast';
import { Download, FileText } from 'lucide-react';
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
        <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
          <InvoiceGenerator 
            booking={booking}
            invoiceNumber={invoiceService.formatInvoiceNumber(booking?.booking_reference)}
          />
        </div>

        {/* Invoice Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Invoice Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><span className="text-gray-600">Invoice #:</span> {invoiceService.formatInvoiceNumber(booking?.booking_reference)}</p>
              <p><span className="text-gray-600">Status:</span> <span className={invoiceStatus.statusColor}>{invoiceStatus.statusText}</span></p>
              <p><span className="text-gray-600">Customer:</span> {booking?.first_name || ''} {booking?.last_name || ''}</p>
            </div>
            <div className="text-right">
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

        {/* Actions */}
        <div className="flex justify-center">
          <Button
            onClick={handleDownload}
            loading={downloading}
            icon={Download}
            className="px-8"
          >
            Download PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceModal;