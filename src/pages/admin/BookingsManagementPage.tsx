import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService';
import { paymentService } from '../../services/paymentService';
import type { BookingDetails, AdminBookingFilters, UpdateBookingStatusRequest } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Card, CardContent } from '../../components/ui/Card';
import toast from 'react-hot-toast';

const BookingsManagementPage: React.FC = () => {
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [filters, setFilters] = useState<AdminBookingFilters>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllBookings(filters);
      setBookings(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const updateStatus = async (booking_id: number, status: UpdateBookingStatusRequest['status']) => {
    try {
      await adminService.updateBookingStatus({ booking_id, status });
      toast.success('Status updated');
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings Management</h1>
      </div>

      <Card className="mb-4">
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="px-3 py-2 border rounded-lg w-full"
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
                className="px-3 py-2 border rounded-lg w-full"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User Search</label>
              <input
                type="text"
                value={filters.user_search || ''}
                onChange={(e) => setFilters({ ...filters, user_search: e.target.value || undefined })}
                placeholder="Name, email"
                className="px-3 py-2 border rounded-lg w-full"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={load} className="w-full">Refresh</Button>
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
              data={bookings}
              keyExtractor={(b) => b.id.toString()}
              columns={[
                { key: 'booking_reference', title: 'Reference' },
                { key: 'first_name', title: 'Customer', render: (_: any, r: BookingDetails) => `${r.first_name} ${r.last_name}` },
                { key: 'field_name', title: 'Field' },
                { key: 'booking_date', title: 'Date' },
                { key: 'start_time', title: 'Start' },
                { key: 'end_time', title: 'End' },
                { key: 'total_amount', title: 'Amount', render: (v: number) => `R ${v.toFixed(2)}` },
                { key: 'status', title: 'Status' },
                { key: 'payment_status', title: 'Payment' },
                {
                  key: 'actions',
                  title: 'Actions',
                  render: (_: any, row: BookingDetails) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => updateStatus(row.id, 'confirmed')}>Confirm</Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(row.id, 'completed')}>Complete</Button>
                      <Button size="sm" variant="error" onClick={() => updateStatus(row.id, 'cancelled')}>Cancel</Button>
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
                        >Mark Paid</Button>
                      )}
                    </div>
                  )
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingsManagementPage;
