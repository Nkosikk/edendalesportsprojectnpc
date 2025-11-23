import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { paymentService } from '../../services/paymentService';
import type { BookingDetails, AdminBookingFilters, UpdateBookingStatusRequest } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { formatCurrency } from '../../lib/utils';
import { Card, CardContent } from '../../components/ui/Card';
import InvoiceModal from '../../components/invoices/InvoiceModal';
import toast from 'react-hot-toast';
import { FileText } from 'lucide-react';

const BookingsManagementPage: React.FC = () => {
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [filters, setFilters] = useState<AdminBookingFilters>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<BookingDetails | null>(null);
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

  const load = async () => {
    console.log('BookingsManagementPage: Loading bookings with filters:', filters);
    try {
      setLoading(true);
      const bookings = await adminService.getAllBookings(filters);
      console.log('BookingsManagementPage: Received bookings:', bookings);
      setBookings(bookings);
      if (!bookings || bookings.length === 0) {
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

  const updateStatus = async (booking_id: number, status: UpdateBookingStatusRequest['status']) => {
    try {
      await adminService.updateBookingStatus({ booking_id, status });
      toast.success('Status updated');
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to update status';
      toast.error(msg);
    }
  };

  // Pagination calculations
  const totalItems = bookings.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBookings = bookings.slice(startIndex, endIndex);

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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">User/Field</label>
              <input
                type="text"
                value={filters.user_search || ''}
                onChange={(e) => setFilters({ ...filters, user_search: e.target.value || undefined })}
                placeholder="Name, email, field"
                className="px-3 py-2 border rounded-lg w-full text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={load} className="w-full" size="sm">Refresh</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <Table
              data={paginatedBookings}
              keyExtractor={(b) => b.id.toString()}
              columns={[
                { key: 'booking_reference', title: 'Reference' },
                { 
                  key: 'customer', 
                  title: 'Customer', 
                  render: (_: any, r: BookingDetails) => (
                    <div>
                      <div className="font-medium">{`${r.first_name} ${r.last_name}`}</div>
                      <div className="text-xs text-gray-500">{r.email}</div>
                      {r.notes && (
                        <div className="text-xs text-blue-600 mt-1" title={r.notes}>
                          📝 {r.notes.length > 30 ? r.notes.substring(0, 30) + '...' : r.notes}
                        </div>
                      )}
                    </div>
                  )
                },
                { key: 'field_name', title: 'Field' },
                { key: 'booking_date', title: 'Date' },
                { key: 'start_time', title: 'Start' },
                { key: 'end_time', title: 'End' },
                { 
                  key: 'total_amount', 
                  title: 'Amount', 
                  render: (v: any) => {
                    const num = Number(v);
                    return Number.isFinite(num) ? formatCurrency(num) : '—';
                  } 
                },
                { key: 'status', title: 'Status' },
                { key: 'payment_status', title: 'Payment' },
                {
                  key: 'actions',
                  title: 'Actions',
                  render: (_: any, row: BookingDetails) => (
                    <div className="flex gap-1 flex-wrap">
                      {/* View Details */}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => window.open(`/app/bookings/${row.id}`, '_blank')}
                      >
                        View
                      </Button>

                      {/* Edit Booking (only for pending/confirmed) */}
                      {(row.status === 'pending' || row.status === 'confirmed') && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => window.open(`/app/bookings/${row.id}/edit`, '_blank')}
                        >
                          Edit
                        </Button>
                      )}

                      {/* Invoice */}
                      <div title="View/Send Invoice">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setSelectedBookingForInvoice(row)}
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Status Actions */}
                      {row.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(row.id, 'confirmed')}>
                          Confirm
                        </Button>
                      )}

                      {row.status === 'confirmed' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatus(row.id, 'completed')}>
                          Complete
                        </Button>
                      )}

                      {(row.status === 'pending' || row.status === 'confirmed') && (
                        <Button size="sm" variant="error" onClick={() => updateStatus(row.id, 'cancelled')}>
                          Cancel
                        </Button>
                      )}

                      {/* Payment Actions */}
                      {row.payment_status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await paymentService.confirmPayment(undefined, row.id);
                              toast.success('Payment confirmed');
                              load();
                            } catch (e: any) {
                              toast.error(e?.response?.data?.message || 'Payment confirm failed');
                            }
                          }}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  )
                },
              ]}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} bookings
              </div>
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
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
    </div>
  );
};

export default BookingsManagementPage;
