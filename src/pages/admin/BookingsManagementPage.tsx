import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { adminService } from '../../services/adminService';

import { fieldService } from '../../services/fieldsService';
import { paymentService } from '../../services/paymentService';
import { bookingService } from '../../services/bookingService';
import type { BookingDetails, AdminBookingFilters, UpdateBookingStatusRequest, SportsField } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { formatCurrency, getRefundAdjustedAmount } from '../../lib/utils';
import { Card, CardContent } from '../../components/ui/Card';
import InvoiceModal from '../../components/invoices/InvoiceModal';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { FileText, MoreVertical, Eye, Edit, Check, X, DollarSign } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const sanitizeAdminFiltersFromState = (source?: Partial<AdminBookingFilters>): AdminBookingFilters => {
  if (!source) return {};
  const result: AdminBookingFilters = {};
  (Object.entries(source) as [keyof AdminBookingFilters, unknown][]).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (key === 'field_id') {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (!Number.isNaN(numeric)) {
        result.field_id = numeric;
      }
      return;
    }
    result[key] = value as any;
  });
  return result;
};

const BookingsManagementPage: React.FC = () => {
  const location = useLocation();
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [filters, setFilters] = useState<AdminBookingFilters>(() => {
    const state = location.state as { filters?: Partial<AdminBookingFilters> } | null;
    return sanitizeAdminFiltersFromState(state?.filters);
  });
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusModal, setStatusModal] = useState<{
    booking: BookingDetails | null;
    status: UpdateBookingStatusRequest['status'];
    reason: string;
    refund: string;
    submitting: boolean;
  }>({ booking: null, status: 'pending', reason: '', refund: '', submitting: false });

  // Keep track of rows we already auto-completed to avoid duplicate updates
  const autoCompletedRef = React.useRef<Set<number>>(new Set());
  const lastErrorTimeRef = React.useRef<number>(0);
  const autoAttemptedRef = React.useRef<Set<number>>(new Set());

  useEffect(() => {
    const state = location.state as { filters?: Partial<AdminBookingFilters> } | null;
    if (!state?.filters) return;
    const sanitized = sanitizeAdminFiltersFromState(state.filters);
    setFilters(prev => {
      const keys = new Set<keyof AdminBookingFilters>([
        ...(Object.keys(prev) as (keyof AdminBookingFilters)[]),
        ...(Object.keys(sanitized) as (keyof AdminBookingFilters)[]),
      ]);
      for (const key of keys) {
        if (prev[key] !== sanitized[key]) {
          return sanitized;
        }
      }
      if (keys.size === 0 && Object.keys(prev).length === 0) {
        return prev;
      }
      return prev;
    });
  }, [location.key, location.state]);

  const shouldAutoComplete = (b: BookingDetails) => {
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

  // ...existing code...
  // Ensure this logic is inside an async function, e.g. load()
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
      const userSearchTerm = (cleanFilters.user_search as string | undefined)?.trim();
      if (userSearchTerm) {
        backendFilters.user_search = userSearchTerm;
        backendFilters.search = userSearchTerm;
        backendFilters.field_name = userSearchTerm;
        backendFilters.field = userSearchTerm;
        backendFilters.reference = userSearchTerm;
        backendFilters.booking_reference = userSearchTerm;
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

      const searchFiltered = userSearchTerm
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
            return haystack.includes(userSearchTerm.toLowerCase());
          })
        : withinRange;

      setBookings(searchFiltered);
      if ((!bookings || bookings.length === 0) && Object.keys(cleanFilters).length === 0) {
        toast.error('No bookings found. Check if you have admin permissions or if bookings exist in the system.');
      }
      // Attempt auto-complete for any bookings whose end time has passed
      const changed = await autoCompleteOverdue(searchFiltered);
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

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
    refundAmount?: number,
    successMessage?: string
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
      toast.success(successMessage ?? 'Status updated');
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

  // Search and pagination calculations
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredBySearch = React.useMemo(() => {
    if (!normalizedSearch) {
      return bookings;
    }
    return bookings.filter((booking) => {
      const haystack = [
        booking.booking_reference,
        booking.first_name,
        booking.last_name,
        booking.email,
        booking.field_name,
        booking.status,
        booking.payment_status,
        booking.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [bookings, normalizedSearch]);

  const totalItems = filteredBySearch.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage) || 1);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBookings = filteredBySearch.slice(startIndex, endIndex);
  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = totalItems === 0 ? 0 : Math.min(endIndex, totalItems);
  const hasSingleResult = !loading && totalItems === 1;

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

  // Helper functions for rendering status badges
  const renderStatusBadge = (status: string) => (
    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
      status === 'confirmed' ? 'bg-green-100 text-green-800' :
      status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
      status === 'completed' ? 'bg-blue-100 text-blue-800' :
      status === 'cancelled' ? 'bg-red-100 text-red-800' :
      'bg-gray-100 text-gray-800'
    }`}>
      {status}
    </span>
  );

  const renderPaymentBadge = (paymentStatus: string) => (
    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
      paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
      paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
      paymentStatus === 'manual_pending' ? 'bg-blue-100 text-blue-800' :
      paymentStatus === 'failed' ? 'bg-red-100 text-red-800' :
      paymentStatus === 'refunded' ? 'bg-gray-100 text-gray-800' :
      'bg-gray-100 text-gray-800'
    }`}>
      {paymentStatus === 'manual_pending' ? 'Manual' : paymentStatus}
    </span>
  );

  // Render action menu with smart positioning
  const renderActionMenu = (booking: BookingDetails, options: { forceAbove?: boolean } = {}) => {
    const dropdownClasses = options.forceAbove 
      ? "absolute right-0 bottom-full mb-1 bg-white border rounded-lg shadow-xl z-[9999] min-w-[160px] max-h-96 overflow-y-auto"
      : "absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-[9999] min-w-[160px] max-h-96 overflow-y-auto";

    return (
      <div className="relative">
        <button 
          className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setOpenDropdown(openDropdown === booking.id ? null : booking.id);
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        
        {openDropdown === booking.id && (
          <div className={dropdownClasses} style={{ zIndex: 9999 }}>
            <div className="py-0">
              {/* View Details */}
              <button
                onClick={() => {
                  window.open(`/app/bookings/${booking.id}`, '_blank');
                  setOpenDropdown(null);
                }}
                className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                View Details
              </button>

              {/* Edit Booking */}
              {(booking.status === 'pending' || booking.status === 'confirmed') && (
                <button
                  onClick={() => {
                    window.open(`/app/bookings/${booking.id}/edit`, '_blank');
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
                  setSelectedBookingForInvoice(booking);
                  setOpenDropdown(null);
                }}
                className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                View Invoice
              </button>
              <div className="border-t my-1"></div>

              {/* Status Actions */}
              {booking.status === 'pending' && booking.payment_status === 'paid' && (
                <button
                  onClick={() => {
                    openStatusModal(booking, 'confirmed');
                    setOpenDropdown(null);
                  }}
                  className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
                >
                  <Check className="h-4 w-4" />
                  Confirm Booking
                </button>
              )}

              {(booking.status === 'pending' || booking.status === 'confirmed') && (
                <button
                  onClick={() => {
                    openStatusModal(booking, 'cancelled');
                    setOpenDropdown(null);
                  }}
                  className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                >
                  <X className="h-4 w-4" />
                  Cancel Booking
                </button>
              )}

              {/* Mark as Completed */}
              {booking.status === 'confirmed' && booking.payment_status === 'paid' && (
                <button
                  onClick={async () => {
                    try {
                      await updateStatus(booking.id, 'completed', undefined, undefined, 'Booking marked as completed');
                    } catch (e: any) {
                      toast.error(e?.response?.data?.message || e?.message || 'Failed to mark as completed');
                    } finally {
                      setOpenDropdown(null);
                    }
                  }}
                  className="w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-blue-600"
                >
                  <Check className="h-4 w-4" />
                  Mark as Completed
                </button>
              )}

              {/* Payment Actions */}
              {booking.status !== 'cancelled' && (booking.payment_status === 'pending' || booking.payment_status === 'manual_pending') && (
                <>
                  <div className="border-t my-1"></div>
                  <button
                    onClick={async () => {
                      const confirmLabel = booking.payment_status === 'manual_pending'
                        ? 'Confirm manual payment'
                        : 'Mark this booking as paid';
                      const confirmation = window.confirm(
                        `${confirmLabel} for ${booking.booking_reference}? This action cannot be undone.`
                      );
                      if (!confirmation) {
                        setOpenDropdown(null);
                        return;
                      }
                      if (processingPayment === booking.id) return;
                      try {
                        setProcessingPayment(booking.id);
                        toast.dismiss();

                        if (booking.payment_status === 'manual_pending') {
                          if (booking.payment_id) {
                            await paymentService.confirmPayment(booking.payment_id, booking.id);
                          }
                        } else {
                          await adminService.markBookingAsPaid(booking.id);
                        }

                        if (booking.status === 'pending') {
                          await adminService.updateBookingStatus({
                            booking_id: booking.id,
                            status: 'confirmed',
                          });
                        }

                        toast.success(`${booking.payment_status === 'manual_pending' ? 'Manual payment' : 'Payment'} recorded successfully`);
                        await load();
                      } catch (e: any) {
                        const errorMessage = (e?.response?.data?.message || e?.message || '').toString();
                        const lower = errorMessage.toLowerCase();
                        if (lower.includes('already paid') || lower.includes('already processed')) {
                          toast.success('Booking payment already captured');
                          await load();
                        } else {
                          const now = Date.now();
                          if (now - lastErrorTimeRef.current > 3000) {
                            toast.error(errorMessage || 'Failed to update payment status');
                            lastErrorTimeRef.current = now;
                          }
                        }
                      } finally {
                        setProcessingPayment(null);
                        setOpenDropdown(null);
                      }
                    }}
                    disabled={processingPayment === booking.id}
                    className={`w-full px-4 py-1 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600 ${
                      processingPayment === booking.id ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <DollarSign className="h-4 w-4" />
                    {booking.payment_status === 'manual_pending' ? 'Confirm Manual Payment' : 'Mark as Paid'}
                  </button>
                </>
              )}

              {/* Mark Refunded (when cancelled and not yet refunded) */}
              {booking.status === 'cancelled' && booking.payment_status !== 'refunded' &&
                booking.payment_status !== 'pending' &&
                booking.payment_status !== 'manual_pending' && (
                <>
                  <div className="border-t my-1"></div>
                  <button
                    onClick={() => {
                      // In historical version this opened a refund modal; here we directly invoke service
                      (async () => {
                        try {
                          const amount = typeof booking.refund_amount === 'number' ? booking.refund_amount : undefined;
                          await adminService.markBookingRefunded({ booking_id: booking.id, amount });
                          toast.success('Refund marked as processed');
                          await load();
                        } catch (e: any) {
                          toast.error(e?.response?.data?.message || e?.message || 'Failed to mark refund');
                        } finally {
                          setOpenDropdown(null);
                        }
                      })();
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
    );
  };

  // Mobile booking card component
  const renderMobileBookingCard = (booking: BookingDetails, options: { forceAbove?: boolean } = {}) => {
    const adjustedAmount = getRefundAdjustedAmount(booking);
    const amountLabel = formatCurrency(Math.abs(adjustedAmount));

    return (
      <div key={booking.id} className="bg-white border rounded-lg p-3 shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <div className="text-xs font-mono text-gray-600">{booking.booking_reference}</div>
          {renderActionMenu(booking, options)}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Customer</div>
          <div className="text-xs font-medium text-gray-900">{`${booking.first_name} ${booking.last_name}`}</div>
          <div className="text-xs text-gray-600 break-all">{booking.email}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs mt-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Field</div>
            <div className="text-gray-900" title={booking.field_name}>{booking.field_name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Date</div>
            <div className="text-gray-900">{booking.booking_date}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Time</div>
            <div className="text-gray-900">
              {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Amount</div>
            <div className="font-semibold text-gray-900">{amountLabel}</div>
            {adjustedAmount < 0 && <div className="text-[10px] text-red-600">Refund</div>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {renderStatusBadge(booking.status)}
          {renderPaymentBadge(booking.payment_status)}
        </div>

        {booking.notes && (
          <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded mt-2">
            📝 {booking.notes}
          </div>
        )}
      </div>
    );
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
    <div className="w-full px-2 sm:px-3 py-4 sm:py-6 max-w-screen-xl mx-auto">
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bookings Management</h1>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToCSV}
            disabled={bookings.length === 0}
            className="text-xs px-2 py-1"
          >
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToPDF}
            disabled={bookings.length === 0}
            className="text-xs px-2 py-1"
          >
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="mb-3">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="px-2 py-1.5 border rounded w-full text-xs"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment</label>
              <select
                value={filters.payment_status || ''}
                onChange={(e) => setFilters({ ...filters, payment_status: e.target.value || undefined })}
                className="px-2 py-1.5 border rounded w-full text-xs"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="manual_pending">Manual</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Field</label>
              <select
                value={filters.field_id || ''}
                onChange={(e) => setFilters({
                  ...filters,
                  field_id: e.target.value ? Number(e.target.value) : undefined,
                })}
                className="px-2 py-1.5 border rounded w-full text-xs"
                disabled={fieldsLoading}
              >
                <option value="">All Fields</option>
                {fieldOptions.map((field) => (
                  <option key={field.id} value={field.id}>{field.name}</option>
                ))}
              </select>
              {fieldsLoading && (
                <p className="text-[10px] text-gray-500 mt-0.5">Loading…</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })}
                className="px-2 py-1.5 border rounded w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })}
                className="px-2 py-1.5 border rounded w-full text-xs"
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Reference, customer, field..."
                className="px-2 py-1.5 border rounded w-full text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={load} className="w-full text-xs px-2 py-1.5" size="sm">Refresh</Button>
            </div>
          </div>
          <div className="mt-2 text-[9px] text-gray-500">Auto-refresh every 60s. Latest bookings appear at top.</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className={hasSingleResult ? 'pb-2' : ''}>
          <div className="mb-4 text-sm font-semibold text-gray-800">Bookings</div>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : paginatedBookings.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No bookings found for the selected filters.
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3 -mx-1">
                {paginatedBookings.map((booking, index) => {
                  const isLast = index === paginatedBookings.length - 1;
                  const shouldForceAbove = paginatedBookings.length > 1 && isLast;
                  return renderMobileBookingCard(booking, { forceAbove: shouldForceAbove });
                })}
              </div>
              <div className="hidden md:block">
                <div className="overflow-x-auto overflow-y-visible -mx-2 sm:mx-0">
                  <Table
                    data={paginatedBookings}
                    keyExtractor={(b) => b.id.toString()}
                    className="min-w-full"
                    columns={[
                { 
                  key: 'booking_reference', 
                  title: 'Reference',
                  className: 'w-[14%]',
                  render: (v: string) => (
                    <div className="text-xs font-mono">{v}</div>
                  )
                },
                { 
                  key: 'customer', 
                  title: 'Customer',
                  className: 'w-[18%]',
                  render: (_: any, r: BookingDetails) => (
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{`${r.first_name} ${r.last_name}`}</div>
                      <div className="text-xs text-gray-500 truncate">{r.email}</div>
                      {r.notes && (
                        <div className="text-xs text-blue-600 mt-0.5 truncate" title={r.notes}>
                          📝 {r.notes.length > 10 ? r.notes.substring(0, 10) + '...' : r.notes}
                        </div>
                      )}
                    </div>
                  )
                },
                { 
                  key: 'field_name', 
                  title: 'Field',
                  className: 'w-[10%]',
                  render: (v: string) => (
                    <div className="text-xs truncate" title={v}>{v}</div>
                  )
                },
                { 
                  key: 'booking_date', 
                  title: 'Date',
                  className: 'w-[7%]',
                  render: (v: string) => (
                    <div className="text-xs">{v?.slice(5) || v}</div>
                  )
                },
                { 
                  key: 'time_slot', 
                  title: 'Time',
                  className: 'w-[8%]',
                  render: (_: any, r: BookingDetails) => (
                    <div className="text-xs leading-tight">
                      <div>{r.start_time.slice(0, 5)}</div>
                      <div className="text-gray-500">{r.end_time.slice(0, 5)}</div>
                    </div>
                  )
                },
                { 
                  key: 'total_amount', 
                  title: 'Amount',
                  className: 'w-[9%]',
                  render: (_: any, r: BookingDetails) => {
                    const displayAmount = getRefundAdjustedAmount(r);
                    return (
                      <div className="text-xs font-medium">
                        <div>{formatCurrency(Math.abs(displayAmount))}</div>
                        {displayAmount < 0 && (
                          <span className="block text-xs text-red-600 leading-tight">
                            Refund
                          </span>
                        )}
                      </div>
                    );
                  } 
                },
                { 
                  key: 'status', 
                  title: 'Status',
                  className: 'w-[11%]',
                  render: (v: string) => renderStatusBadge(v)
                },
                { 
                  key: 'payment_status', 
                  title: 'Payment',
                  className: 'w-[11%]',
                  render: (v: string) => renderPaymentBadge(v)
                },
                {
                  key: 'actions',
                  title: 'Action',
                  className: 'w-[13%]',
                  render: (_: any, row: BookingDetails, index: number) => 
                    renderActionMenu(row, {
                      forceAbove: paginatedBookings.length > 1 && index === paginatedBookings.length - 1
                    })
                }
              ]}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <Card className={hasSingleResult ? 'mt-2' : 'mt-4'}>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-gray-600">
              Showing {displayStart} to {displayEnd} of {totalItems} booking{totalItems !== 1 ? 's' : ''}
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                value={itemsPerPage} 
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-2 py-1 border rounded text-xs"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
              
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="text-xs px-2 py-1"
                >
                  Previous
                </Button>
                
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(page)}
                        className="text-xs px-2 py-1 min-w-[2rem]"
                      >
                        {page}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && <span className="text-xs text-gray-500 px-2">...</span>}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="text-xs px-2 py-1"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedBookingForInvoice && (
        <InvoiceModal
          isOpen={true}
          booking={selectedBookingForInvoice}
          onClose={() => setSelectedBookingForInvoice(null)}
        />
      )}

      {/* Status Modal */}
      {statusModal.booking && (
        <Modal
          isOpen={!!statusModal.booking}
          onClose={closeStatusModal}
          title={`${statusModal.status === 'confirmed' ? 'Confirm' : statusModal.status === 'cancelled' ? 'Cancel' : 'Update'} Booking`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {statusModal.status === 'confirmed' && 'Are you sure you want to confirm this booking?'}
              {statusModal.status === 'cancelled' && 'Please provide a reason for cancelling this booking:'}
            </p>
            
            {statusModal.status === 'cancelled' && (
              <textarea
                value={statusModal.reason}
                onChange={(e) => setStatusModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for cancellation..."
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
              />
            )}
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeStatusModal} disabled={statusModal.submitting}>
                Cancel
              </Button>
              <Button 
                onClick={handleStatusModalSubmit}
                disabled={statusModal.submitting}
                className={statusModal.status === 'cancelled' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {statusModal.submitting ? 'Processing...' : 
                 statusModal.status === 'confirmed' ? 'Confirm Booking' : 
                 statusModal.status === 'cancelled' ? 'Cancel Booking' : 'Update'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default BookingsManagementPage;
