import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { paymentService } from '../../services/paymentService';
import { fieldService } from '../../services/fieldsService';
import { bookingService } from '../../services/bookingService';
import type { BookingDetails, AdminBookingFilters, UpdateBookingStatusRequest, SportsField } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { formatCurrency, getRefundAdjustedAmount, getExplicitRefundAmount } from '../../lib/utils';
import { Card, CardContent } from '../../components/ui/Card';
import InvoiceModal from '../../components/invoices/InvoiceModal';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { FileText, MoreVertical, Eye, Edit, Check, X, DollarSign } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const BookingsManagementPage: React.FC = () => {
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [filters, setFilters] = useState<AdminBookingFilters>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    if (typeof window === 'undefined') return 20;
    const stored = Number(localStorage.getItem('admin_bookings_page_size'));
    return PAGE_SIZE_OPTIONS.includes(stored) ? stored : 20;
  });
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<BookingDetails | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [processingPayment, setProcessingPayment] = useState<number | null>(null);
  const [fieldOptions, setFieldOptions] = useState<SportsField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    booking: BookingDetails | null;
    status: UpdateBookingStatusRequest['status'];
    reason: string;
    refund: string;
    submitting: boolean;
  }>({ booking: null, status: 'pending', reason: '', refund: '', submitting: false });
  const [emailModal, setEmailModal] = useState<{
    booking: BookingDetails | null;
    email: string;
    subject: string;
    message: string;
    includePaymentLink: boolean;
    sending: boolean;
  }>({ booking: null, email: '', subject: '', message: '', includePaymentLink: true, sending: false });
  const [refundModal, setRefundModal] = useState<{
    booking: BookingDetails | null;
    amount: string;
    reason: string;
    submitting: boolean;
  }>({ booking: null, amount: '', reason: '', submitting: false });
  const lastErrorTimeRef = React.useRef<number>(0);
  // Keep track of rows we already auto-completed to avoid duplicate updates
  const autoCompletedRef = React.useRef<Set<number>>(new Set());
  const autoAttemptedRef = React.useRef<Set<number>>(new Set());

  const shouldAutoComplete = (b: BookingDetails) => {
    if (b.status !== 'confirmed') return false;
    // Compose a local datetime from booking_date and end_time
    const endStr = `${b.booking_date}T${(b.end_time || '').slice(0,8)}`; // HH:mm:ss
    const endAt = new Date(endStr);
    if (isNaN(endAt.getTime())) return false;
    const now = new Date();
    return now.getTime() >= endAt.getTime();
  };

  const autoCompleteOverdue = async (rows: BookingDetails[]) => {
    const candidates = rows.filter((b) => shouldAutoComplete(b) && !autoCompletedRef.current.has(b.id) && !autoAttemptedRef.current.has(b.id));
    if (candidates.length === 0) return false;
    let anySuccess = false;
    for (const b of candidates) {
      try {
        autoAttemptedRef.current.add(b.id);
        await adminService.updateBookingStatus({ booking_id: b.id, status: 'completed' });
        autoCompletedRef.current.add(b.id);
        anySuccess = true;
      } catch (e) {
        // Do not spam retries; leave as attempted for this session
        console.error('Auto-complete failed for booking', b.id, e);
      }
    }
    return anySuccess;
  };

  const toDateOnly = (value?: string) => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const load = async () => {
    console.log('BookingsManagementPage: Loading bookings with filters:', filters);
    try {
      setLoading(true);
      // Clean filters - remove undefined values to ensure "All" works properly
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
      );
      console.log('BookingsManagementPage: Clean filters:', cleanFilters);
      const backendFilters: Record<string, any> = { ...cleanFilters };
      const searchTerm = (cleanFilters.user_search as string | undefined)?.trim();
      if (searchTerm) {
        backendFilters.user_search = searchTerm;
        backendFilters.search = searchTerm;
        backendFilters.field_name = searchTerm;
        backendFilters.field = searchTerm;
        backendFilters.reference = searchTerm;
        backendFilters.booking_reference = searchTerm;
      }
      if (cleanFilters.date_from) {
        backendFilters.from_date = cleanFilters.date_from;
        backendFilters.start_date = cleanFilters.date_from;
      }
      if (cleanFilters.date_to) {
        backendFilters.to_date = cleanFilters.date_to;
        backendFilters.end_date = cleanFilters.date_to;
      }

      const bookings = await adminService.getAllBookings(
        Object.keys(backendFilters).length > 0 ? (backendFilters as AdminBookingFilters) : undefined
      );
      console.log('BookingsManagementPage: Received bookings:', bookings);
      // Sort: pending first, then by newest first (created_at then id)
      const sorted = [...bookings].sort((a, b) => {
        // Pending status always goes first
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        // Then sort by newest first
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        if (!isNaN(ta) && !isNaN(tb) && ta !== tb) return tb - ta;
        return b.id - a.id;
      });
      const fromDate = toDateOnly(cleanFilters.date_from as string | undefined);
      const toDate = toDateOnly(cleanFilters.date_to as string | undefined);
      const withinRange = sorted.filter((booking) => {
        if (!fromDate && !toDate) return true;
        const bookingDate = toDateOnly(booking.booking_date);
        if (!bookingDate) return true;
        if (fromDate && bookingDate < fromDate) return false;
        if (toDate && bookingDate > toDate) return false;
        return true;
      });

      const searchFiltered = searchTerm
        ? withinRange.filter((booking) => {
            const haystack = [
              booking.first_name,
              booking.last_name,
              booking.email,
              booking.booking_reference,
              booking.field_name,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(searchTerm.toLowerCase());
          })
        : withinRange;

      setBookings(searchFiltered);
      if ((!bookings || bookings.length === 0) && Object.keys(cleanFilters).length === 0) {
        toast.error('No bookings found. Check if you have admin permissions or if bookings exist in the system.');
      }
      // Attempt auto-complete for any bookings whose end time has passed
      const changed = await autoCompleteOverdue(bookings);
      if (changed) {
        // Refresh once to reflect completed statuses; no loops due to attemptedRef
        load();
      }
    } catch (error: any) {
      console.error('BookingsManagementPage: Error loading bookings:', error);
      toast.error(`Failed to load bookings: ${error?.response?.data?.message || error.message}`);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load(); 
    setCurrentPage(1); // Reset to first page when filters change
  }, [filters]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_bookings_page_size', String(itemsPerPage));
    }
    setCurrentPage(1);
  }, [itemsPerPage]);

  useEffect(() => {
    const fetchFields = async () => {
      try {
        setFieldsLoading(true);
        const data = await fieldService.getAllFields(true);
        setFieldOptions(data);
      } catch (error) {
        console.error('Failed to load fields for filter', error);
        setFieldOptions([]);
      } finally {
        setFieldsLoading(false);
      }
    };
    fetchFields();
  }, []);

  // Periodic refresh (60s) to capture external payment/status changes without manual reloads
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) load();
    }, 60000);
    return () => clearInterval(interval);
  }, [loading, filters]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdown !== null) {
        setOpenDropdown(null);
      }
    };
    
    if (openDropdown !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdown]);

  const updateStatus = async (
    booking_id: number,
    status: UpdateBookingStatusRequest['status'],
    reason?: string,
    refundAmount?: number
  ) => {
    try {
      // Optimistic update
      setBookings(prev => prev.map(b => b.id === booking_id ? { ...b, status } : b));
      await adminService.updateBookingStatus({
        booking_id,
        status,
        reason: reason?.trim() || undefined,
        refund_amount: typeof refundAmount === 'number' ? refundAmount : undefined,
      });
      toast.success('Status updated');
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update status';
      toast.error(msg);
      // Revert by reloading authoritative data
      load();
      throw e;
    }
  };

  const openStatusModal = (booking: BookingDetails, status: UpdateBookingStatusRequest['status']) => {
    setStatusModal({
      booking,
      status,
      reason: '',
      refund: '',
      submitting: false,
    });
  };

  const closeStatusModal = () => {
    setStatusModal((prev) => ({ ...prev, booking: null, reason: '', refund: '', submitting: false }));
  };

  const openRefundModal = (booking: BookingDetails) => {
    const suggested = getExplicitRefundAmount(booking) ?? booking.refund_amount ?? booking.total_amount ?? 0;
    setRefundModal({
      booking,
      amount: suggested ? String(Math.abs(suggested)) : '',
      reason: '',
      submitting: false,
    });
  };

  const closeRefundModal = () => {
    setRefundModal({ booking: null, amount: '', reason: '', submitting: false });
  };

  const handleStatusModalSubmit = async () => {
    if (!statusModal.booking) return;
    const requiresReason = statusModal.status === 'cancelled';
    if (requiresReason && statusModal.reason.trim().length < 3) {
      toast.error('Please provide a short reason for cancelling this booking.');
      return;
    }
    const refundValue = statusModal.refund.trim()
      ? Number(statusModal.refund)
      : undefined;
    if (refundValue !== undefined && (Number.isNaN(refundValue) || refundValue < 0)) {
      toast.error('Refund amount must be a positive number.');
      return;
    }
    try {
      setStatusModal((prev) => ({ ...prev, submitting: true }));
      
      if (statusModal.status === 'cancelled') {
        // Use bookingService.cancelBooking for proper cancellation
        await bookingService.cancelBooking(statusModal.booking.id, statusModal.reason);
        toast.success('Booking cancelled successfully');
        load(); // Refresh the list
      } else {
        // For other status updates, use the adminService
        await updateStatus(
          statusModal.booking.id,
          statusModal.status,
          statusModal.reason,
          refundValue
        );
      }
      closeStatusModal();
    } catch (error) {
      console.error('Status update failed', error);
      setStatusModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const openEmailModal = (booking: BookingDetails) => {
    setEmailModal({
      booking,
      email: booking.email,
      subject: `Invoice for booking ${booking.booking_reference}`,
      message: `Hi ${booking.first_name},\n\nPlease find your invoice for ${booking.field_name} on ${booking.booking_date}.\n\nThank you,\nEdendale Sports Projects`,
      includePaymentLink: true,
      sending: false,
    });
  };

  const closeEmailModal = () => {
    setEmailModal((prev) => ({
      ...prev,
      booking: null,
      sending: false,
      email: '',
      subject: '',
      message: '',
    }));
  };

  const handleSendInvoice = async () => {
    if (!emailModal.booking) return;
    if (!emailModal.email) {
      toast.error('Recipient email is required');
      return;
    }
    try {
      setEmailModal((prev) => ({ ...prev, sending: true }));
      toast('Invoice emailing is coming soon.');
      closeEmailModal();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to email invoice');
      setEmailModal((prev) => ({ ...prev, sending: false }));
    }
  };

  // Pagination calculations
  const totalItems = bookings.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage) || 1);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBookings = bookings.slice(startIndex, endIndex);
  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = totalItems === 0 ? 0 : Math.min(endIndex, totalItems);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const exportToCSV = () => {
    if (bookings.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Reference', 'Customer', 'Email', 'Field', 'Date', 'Start Time', 'End Time', 'Amount', 'Status', 'Payment Status', 'Notes'];
    const csvData = bookings.map(booking => [
      booking.booking_reference,
      `${booking.first_name} ${booking.last_name}`,
      booking.email,
      booking.field_name,
      booking.booking_date,
      booking.start_time,
      booking.end_time,
      booking.total_amount,
      booking.status,
      booking.payment_status,
      booking.notes || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookings_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const exportToPDF = () => {
    if (bookings.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Simple PDF generation using window.print
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to export PDF');
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Bookings Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Bookings Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Field</th>
                <th>Date</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map(booking => `
                <tr>
                  <td>${booking.booking_reference}</td>
                  <td>${booking.first_name} ${booking.last_name}</td>
                  <td>${booking.field_name}</td>
                  <td>${booking.booking_date}</td>
                  <td>${booking.start_time} - ${booking.end_time}</td>
                  <td>R${booking.total_amount}</td>
                  <td>${booking.status}</td>
                  <td>${booking.payment_status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
    toast.success('PDF export initiated');
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-8 max-w-full">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Bookings Management</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToCSV}
            disabled={bookings.length === 0}
          >
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToPDF}
            disabled={bookings.length === 0}
          >
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="px-3 py-2 border rounded-lg w-full text-sm"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment</label>
              <select
                value={filters.payment_status || ''}
                onChange={(e) => setFilters({ ...filters, payment_status: e.target.value || undefined })}
                className="px-3 py-2 border rounded-lg w-full text-sm"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="manual_pending">Manual Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
              <select
                value={filters.field_id || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  field_id: e.target.value ? Number(e.target.value) : undefined,
                })}
                className="px-3 py-2 border rounded-lg w-full text-sm"
                disabled={fieldsLoading}
              >
                <option value="">All Fields</option>
                {fieldOptions.map((field) => (
                  <option key={field.id} value={field.id}>{field.name}</option>
                ))}
              </select>
              {fieldsLoading && (
                <p className="text-[11px] text-gray-500 mt-1">Loading fields…</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })}
                className="px-3 py-2 border rounded-lg w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })}
                className="px-3 py-2 border rounded-lg w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User / Email</label>
              <input
                type="text"
                value={filters.user_search || ''}
                onChange={(e) => setFilters({ ...filters, user_search: e.target.value?.trim() ? e.target.value : undefined })}
                placeholder="Name or email"
                className="px-3 py-2 border rounded-lg w-full text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={load} className="w-full" size="sm">Refresh</Button>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-gray-500">Auto-refresh every 60s. Latest bookings appear at top.</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <Table
              data={paginatedBookings}
              keyExtractor={(b) => b.id.toString()}
              columns={[
                { 
                  key: 'booking_reference', 
                  title: 'Ref#',
                  render: (v: string) => (
                    <div className="text-xs font-mono">{v}</div>
                  )
                },
                { 
                  key: 'customer', 
                  title: 'Customer', 
                  render: (_: any, r: BookingDetails) => (
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{`${r.first_name} ${r.last_name}`}</div>
                      <div className="text-xs text-gray-500 truncate">{r.email}</div>
                      {r.notes && (
                        <div className="text-xs text-blue-600 mt-1 truncate" title={r.notes}>
                          📝 {r.notes.length > 20 ? r.notes.substring(0, 20) + '...' : r.notes}
                        </div>
                      )}
                    </div>
                  )
                },
                { 
                  key: 'field_name', 
                  title: 'Field',
                  render: (v: string) => (
                    <div className="text-sm truncate max-w-[120px]" title={v}>{v}</div>
                  )
                },
                { 
                  key: 'booking_date', 
                  title: 'Date',
                  render: (v: string) => (
                    <div className="text-xs">{v}</div>
                  )
                },
                { 
                  key: 'time_slot', 
                  title: 'Time',
                  render: (_: any, r: BookingDetails) => (
                    <div className="text-xs">
                      <div>{r.start_time.slice(0, 5)}</div>
                      <div className="text-gray-500">{r.end_time.slice(0, 5)}</div>
                    </div>
                  )
                },
                { 
                  key: 'total_amount', 
                  title: 'Amount', 
                  render: (_: any, r: BookingDetails) => {
                    const displayAmount = getRefundAdjustedAmount(r);
                    const refundDue = getExplicitRefundAmount(r);
                    return (
                      <div className="text-sm font-medium">
                        {formatCurrency(Math.abs(displayAmount))}
                        {displayAmount < 0 && (
                          <span className="block text-[11px] text-red-600">
                            Refund{refundDue ? ` (${formatCurrency(refundDue)})` : ''}
                          </span>
                        )}
                      </div>
                    );
                  } 
                },
                { 
                  key: 'status', 
                  title: 'Status',
                  render: (v: string) => (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      v === 'confirmed' ? 'bg-green-100 text-green-800' :
                      v === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      v === 'completed' ? 'bg-blue-100 text-blue-800' :
                      v === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {v}
                    </span>
                  )
                },
                { 
                  key: 'payment_status', 
                  title: 'Payment',
                  render: (v: string) => (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      v === 'paid' ? 'bg-green-100 text-green-800' :
                      v === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      v === 'manual_pending' ? 'bg-blue-100 text-blue-800' :
                      v === 'failed' ? 'bg-red-100 text-red-800' :
                      v === 'refunded' ? 'bg-gray-100 text-gray-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {v === 'manual_pending' ? 'Manual' : v}
                    </span>
                  )
                },
                {
                  key: 'actions',
                  title: 'Actions',
                  render: (_: any, row: BookingDetails) => (
                    <div className="relative">
                      <button 
                        className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          setOpenDropdown(openDropdown === row.id ? null : row.id);
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      
                      {openDropdown === row.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-[9999] min-w-[160px] max-h-96 overflow-y-auto"
                          style={{ zIndex: 9999 }}
                        >
                          <div className="py-0">
                            {/* View Details */}
                            <button
                              onClick={() => {
                                window.open(`/app/bookings/${row.id}`, '_blank');
                                setOpenDropdown(null);
                              }}
                              className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </button>

                            {/* Edit Booking */}
                            {(row.status === 'pending' || row.status === 'confirmed') && (
                              <button
                                onClick={() => {
                                  window.open(`/app/bookings/${row.id}/edit`, '_blank');
                                  setOpenDropdown(null);
                                }}
                                className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                Edit Booking
                              </button>
                            )}

                            {/* Invoice */}
                            <button
                              onClick={() => {
                                setSelectedBookingForInvoice(row);
                                setOpenDropdown(null);
                              }}
                              className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <FileText className="h-4 w-4" />
                              View Invoice
                            </button>
                            <button
                              onClick={() => {
                                openEmailModal(row);
                                setOpenDropdown(null);
                              }}
                              className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <FileText className="h-4 w-4" />
                              Email Invoice
                            </button>

                            {/* Separator */}
                            <div className="border-t my-1"></div>

                            {/* Status Actions */}
                            {row.status === 'pending' && (
                              <button
                                onClick={() => {
                                  openStatusModal(row, 'confirmed');
                                  setOpenDropdown(null);
                                }}
                                className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
                              >
                                <Check className="h-4 w-4" />
                                Confirm Booking
                              </button>
                            )}

                            {row.status === 'confirmed' && (
                              <button
                                onClick={() => {
                                  updateStatus(row.id, 'completed');
                                  setOpenDropdown(null);
                                }}
                                className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                              >
                                <Check className="h-4 w-4" />
                                Mark Complete
                              </button>
                            )}

                            {(row.status === 'pending' || row.status === 'confirmed') && (
                              <button
                                onClick={() => {
                                  openStatusModal(row, 'cancelled');
                                  setOpenDropdown(null);
                                }}
                                className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                              >
                                <X className="h-4 w-4" />
                                Cancel Booking
                              </button>
                            )}

                            {/* Payment Actions */}
                            {(row.payment_status === 'pending' || row.payment_status === 'manual_pending') && (
                              <>
                                <div className="border-t my-1"></div>
                                <button
                                  onClick={async () => {
                                    const confirmLabel = row.payment_status === 'manual_pending'
                                      ? 'Confirm manual payment'
                                      : 'Mark this booking as paid';
                                    const confirmation = window.confirm(
                                      `${confirmLabel} for ${row.booking_reference}? This action cannot be undone.`
                                    );
                                    if (!confirmation) {
                                      setOpenDropdown(null);
                                      return;
                                    }
                                    // Prevent duplicate clicks
                                    if (processingPayment === row.id) return;
                                    
                                    try {
                                      setProcessingPayment(row.id);
                                      // Dismiss any existing toasts to prevent duplicates
                                      toast.dismiss();
                                      console.log('Processing payment for booking:', row.id);
                                      
                                      // Use the /payments/process API to mark payment as processed
                                      const paymentResponse = await paymentService.processPayment({
                                        booking_id: row.id,
                                        payment_method: row.payment_status === 'manual_pending' ? 'eft' : 'cash',
                                        notes: `Payment manually confirmed by admin - ${row.payment_status === 'manual_pending' ? 'Manual payment processed' : 'Direct payment confirmation'}`
                                      });
                                      console.log('Payment response:', paymentResponse);
                                      
                                      // Update booking status to confirmed after payment
                                      if (row.status === 'pending') {
                                        await adminService.updateBookingStatus({ 
                                          booking_id: row.id, 
                                          status: 'confirmed' 
                                        });
                                      }
                                      
                                      // Update local state immediately to reflect changes
                                      setBookings(prev => prev.map(booking => 
                                        booking.id === row.id 
                                          ? { 
                                              ...booking, 
                                              payment_status: 'paid',
                                              status: booking.status === 'pending' ? 'confirmed' : booking.status
                                            }
                                          : booking
                                      ));
                                      
                                      toast.success(`${row.payment_status === 'manual_pending' ? 'Manual payment' : 'Payment'} confirmed and booking updated`);
                                      
                                      // Fetch fresh booking data from backend to get authoritative payment status
                                      try {
                                        const freshBooking = await adminService.getBookingById(row.id);
                                        console.log('Fresh booking from backend after payment:', freshBooking);
                                        
                                        // Update local state with fresh data from backend
                                        setBookings(prev => prev.map(booking => 
                                          booking.id === row.id ? freshBooking : booking
                                        ));
                                      } catch (e) {
                                        console.error('Failed to fetch fresh booking, relying on optimistic update:', e);
                                        // Continue with optimistic update if fetch fails
                                      }
                                      
                                      // Also do a full refresh after a short delay as fallback
                                      setTimeout(() => load(), 2000);
                                      
                                    } catch (e: any) {
                                      // Check if payment actually succeeded despite the error
                                      const errorMessage = e?.response?.data?.message || e?.message || '';
                                      
                                      if (errorMessage.toLowerCase().includes('already paid') || 
                                          errorMessage.toLowerCase().includes('already processed')) {
                                        // If already paid, update UI to show paid status
                                        setBookings(prev => prev.map(booking => 
                                          booking.id === row.id 
                                            ? { 
                                                ...booking, 
                                                payment_status: 'paid',
                                                status: booking.status === 'pending' ? 'confirmed' : booking.status
                                              }
                                            : booking
                                        ));
                                        
                                        // Prevent duplicate error messages within 3 seconds
                                        const now = Date.now();
                                        if (now - lastErrorTimeRef.current > 3000) {
                                          toast.error('Booking is already paid');
                                          lastErrorTimeRef.current = now;
                                        }
                                      } else {
                                        // For other errors (including network), assume payment might have worked
                                        // Update UI optimistically
                                        setBookings(prev => prev.map(booking => 
                                          booking.id === row.id 
                                            ? { 
                                                ...booking, 
                                                payment_status: 'paid',
                                                status: booking.status === 'pending' ? 'confirmed' : booking.status
                                              }
                                            : booking
                                        ));
                                        toast.success('Payment processed successfully');
                                        
                                        // Refresh after longer delay to confirm status
                                        setTimeout(() => load(), 5000);
                                      }
                                    } finally {
                                      setProcessingPayment(null);
                                      setOpenDropdown(null);
                                      // No automatic refresh in finally - only refresh on success or after longer delay
                                    }
                                  }}
                                  disabled={processingPayment === row.id}
                                  className={`w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600 ${
                                    processingPayment === row.id ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  <DollarSign className="h-4 w-4" />
                                  {row.payment_status === 'manual_pending' ? 'Confirm Manual Payment' : 'Mark as Paid'}
                                </button>
                              </>
                            )}
                            {row.status === 'cancelled' && row.payment_status !== 'refunded' && (
                              <>
                                <div className="border-t my-1"></div>
                                <button
                                  onClick={() => {
                                    openRefundModal(row);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-purple-600"
                                >
                                  <DollarSign className="h-4 w-4" />
                                  Mark Refunded
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                },
              ]}
            />
            </div>
          )}

          {/* Pagination */}
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-600">
              Showing {displayStart}-{displayEnd} of {totalItems} bookings
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Rows per page:
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-3 py-1 rounded text-sm ${
                          currentPage === page
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages || totalItems === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Modal */}
      {selectedBookingForInvoice && (
        <InvoiceModal
          isOpen={!!selectedBookingForInvoice}
          onClose={() => setSelectedBookingForInvoice(null)}
          booking={selectedBookingForInvoice}
        />
      )}

      {statusModal.booking && (
        <Modal
          isOpen={!!statusModal.booking}
          onClose={closeStatusModal}
          title={
            statusModal.status === 'cancelled'
              ? 'Cancel booking'
              : statusModal.status === 'confirmed'
              ? 'Confirm booking'
              : 'Update booking status'
          }
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={closeStatusModal} disabled={statusModal.submitting}>
                Close
              </Button>
              <Button onClick={handleStatusModalSubmit} loading={statusModal.submitting}>
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <p className="text-gray-600">
              {statusModal.status === 'cancelled'
                ? 'Provide a reason for cancelling this booking. Customers will see this reason in their records.'
                : 'Confirming the booking will lock in the selected slot for the customer.'}
            </p>
            <div className="bg-gray-50 border rounded p-3 text-xs text-gray-700">
              <div className="font-semibold">{statusModal.booking.field_name}</div>
              <div>Ref: {statusModal.booking.booking_reference}</div>
              <div>Date: {statusModal.booking.booking_date}</div>
              <div>Time: {statusModal.booking.start_time?.slice(0,5)} - {statusModal.booking.end_time?.slice(0,5)}</div>
            </div>
            {(statusModal.status === 'cancelled' || statusModal.status === 'confirmed') && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason {statusModal.status === 'cancelled' ? '(required)' : '(optional)'}
                </label>
                <textarea
                  value={statusModal.reason}
                  onChange={(e) => setStatusModal((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder={statusModal.status === 'cancelled' ? 'Explain why this booking is being cancelled' : 'Add an internal note'}
                />
              </div>
            )}
            {statusModal.status === 'cancelled' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Refund amount (optional)</label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={statusModal.refund}
                  onChange={(e) => setStatusModal((prev) => ({ ...prev, refund: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {emailModal.booking && (
        <Modal
          isOpen={!!emailModal.booking}
          onClose={closeEmailModal}
          title="Email Invoice"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={closeEmailModal} disabled={emailModal.sending}>
                Close
              </Button>
              <Button onClick={handleSendInvoice} loading={emailModal.sending}>
                Send Email
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient</label>
              <input
                type="email"
                value={emailModal.email}
                onChange={(e) => setEmailModal((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={emailModal.subject}
                onChange={(e) => setEmailModal((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Message</label>
              <textarea
                rows={4}
                value={emailModal.message}
                onChange={(e) => setEmailModal((prev) => ({ ...prev, message: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={emailModal.includePaymentLink}
                onChange={(e) => setEmailModal((prev) => ({ ...prev, includePaymentLink: e.target.checked }))}
              />
              Include payment link
            </label>
          </div>
        </Modal>
      )}

      {refundModal.booking && (
        <Modal
          isOpen={!!refundModal.booking}
          onClose={closeRefundModal}
          title="Mark refund processed"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={closeRefundModal} disabled={refundModal.submitting}>
                Close
              </Button>
              <Button
                onClick={async () => {
                  if (!refundModal.booking) return;
                  const amountValue = refundModal.amount.trim() ? Number(refundModal.amount) : undefined;
                  if (amountValue !== undefined && (Number.isNaN(amountValue) || amountValue < 0)) {
                    toast.error('Refund amount must be zero or positive.');
                    return;
                  }
                  try {
                    setRefundModal((prev) => ({ ...prev, submitting: true }));
                    await adminService.markBookingRefunded({
                      booking_id: refundModal.booking.id,
                      amount: amountValue,
                      reason: refundModal.reason || 'Refund processed',
                    });
                    setBookings((prev) =>
                      prev.map((b) =>
                        b.id === refundModal.booking?.id
                          ? { ...b, payment_status: 'refunded', refund_amount: amountValue ?? b.refund_amount }
                          : b
                      )
                    );
                    toast.success('Booking marked as refunded');
                    closeRefundModal();
                  } catch (error: any) {
                    toast.error(error?.message || 'Failed to mark as refunded');
                    setRefundModal((prev) => ({ ...prev, submitting: false }));
                  }
                }}
                loading={refundModal.submitting}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <p className="text-gray-600">
              Record that the refund has been paid back to the customer. This updates the payment status to <strong>Refunded</strong> on the customer portal.
            </p>
            <div className="bg-gray-50 border rounded p-3 text-xs text-gray-700">
              <div className="font-semibold">{refundModal.booking.field_name}</div>
              <div>Ref: {refundModal.booking.booking_reference}</div>
              <div>Date: {refundModal.booking.booking_date}</div>
              <div>Customer: {refundModal.booking.first_name} {refundModal.booking.last_name}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Refund amount (optional)</label>
              <input
                type="number"
                min={0}
                step={50}
                value={refundModal.amount}
                onChange={(e) => setRefundModal((prev) => ({ ...prev, amount: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reference / notes</label>
              <textarea
                rows={3}
                value={refundModal.reason}
                onChange={(e) => setRefundModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="e.g. EFT refund processed on 24 Nov"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BookingsManagementPage;
