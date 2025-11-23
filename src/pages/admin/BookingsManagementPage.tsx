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
import { FileText, MoreVertical, Eye, Edit, Check, X, DollarSign } from 'lucide-react';

const BookingsManagementPage: React.FC = () => {
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [filters, setFilters] = useState<AdminBookingFilters>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<BookingDetails | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
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
            <div className="overflow-x-auto">
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
                  render: (v: any) => {
                    const num = Number(v);
                    return (
                      <div className="text-sm font-medium">
                        {Number.isFinite(num) ? formatCurrency(num) : '—'}
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
                      v === 'failed' ? 'bg-red-100 text-red-800' :
                      v === 'refunded' ? 'bg-gray-100 text-gray-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {v}
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
                        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[160px]">
                          <div className="py-1">
                            {/* View Details */}
                            <button
                              onClick={() => {
                                window.open(`/app/bookings/${row.id}`, '_blank');
                                setOpenDropdown(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
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
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
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
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <FileText className="h-4 w-4" />
                              View Invoice
                            </button>

                            {/* Separator */}
                            <div className="border-t my-1"></div>

                            {/* Status Actions */}
                            {row.status === 'pending' && (
                              <button
                                onClick={() => {
                                  updateStatus(row.id, 'confirmed');
                                  setOpenDropdown(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
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
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                              >
                                <Check className="h-4 w-4" />
                                Mark Complete
                              </button>
                            )}

                            {(row.status === 'pending' || row.status === 'confirmed') && (
                              <button
                                onClick={() => {
                                  updateStatus(row.id, 'cancelled');
                                  setOpenDropdown(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                              >
                                <X className="h-4 w-4" />
                                Cancel Booking
                              </button>
                            )}

                            {/* Payment Actions */}
                            {row.payment_status === 'pending' && (
                              <>
                                <div className="border-t my-1"></div>
                                <button
                                  onClick={async () => {
                                    try {
                                      await paymentService.confirmPayment(undefined, row.id);
                                      toast.success('Payment confirmed');
                                      load();
                                      setOpenDropdown(null);
                                    } catch (e: any) {
                                      toast.error(e?.response?.data?.message || 'Payment confirm failed');
                                    }
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
                                >
                                  <DollarSign className="h-4 w-4" />
                                  Mark as Paid
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
