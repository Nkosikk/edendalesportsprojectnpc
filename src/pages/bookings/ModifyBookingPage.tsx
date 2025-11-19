import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { bookingService } from '../../services/bookingService';
import BookingCalendar from '../../components/bookings/BookingCalendar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { BookingDetails } from '../../types';
import { useState } from 'react';

const ModifyBookingPage = () => {
  const { id } = useParams();
  const bookingId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());
  const [duration, setDuration] = useState<number>(1);
  const [startTime, setStart] = useState<string | null>(null);
  const [endTime, setEnd] = useState<string | null>(null);
  const [cost, setCost] = useState<number>(0);

  const { data: booking, isLoading: loadingBooking } = useQuery<BookingDetails>(['booking', bookingId], () => bookingService.getBookingById(bookingId), { enabled: !!bookingId });

  const updateMutation = useMutation(
    async () => {
      if (!startTime || !endTime) throw new Error('No slot selected');
      return bookingService.updateBooking(bookingId, {
        booking_date: date.toISOString().split('T')[0],
        start_time: startTime,
        end_time: endTime,
      });
    },
    {
      onSuccess: () => {
        toast.success('Booking updated');
        qc.invalidateQueries(['bookings']);
        qc.invalidateQueries(['booking', bookingId]);
        navigate('/app/bookings');
      },
      onError: (e: any) => {
        toast.error(e?.response?.data?.message || e.message || 'Update failed');
      }
    }
  );

  const handleSelect = (start: string, end: string, c: number) => {
    setStart(start); setEnd(end); setCost(c);
  };

  if (loadingBooking) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (!booking) {
    return <div className="p-6 text-sm text-gray-600">Booking not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modify Booking</h1>
          <p className="text-xs text-gray-600">Original: {booking.booking_date} {booking.start_time}-{booking.end_time}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg border">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={date.toISOString().split('T')[0]} onChange={e => setDate(new Date(e.target.value + 'T00:00:00'))} className="input text-sm" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Duration</label>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="input text-sm">
              {[1,2,3,4].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
          <div className="flex items-end"><Button variant="outline" size="sm" onClick={() => { setDate(new Date()); setDuration(1); setStart(null); setEnd(null); }}>Reset</Button></div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <BookingCalendar fieldId={booking.field_id} date={date} duration={duration} onSelect={handleSelect} />
        </div>
        <div className="bg-white p-4 rounded-lg border flex flex-col md:flex-row gap-6">
          <div className="flex-1 text-xs space-y-1 text-gray-700">
            <div><span className="font-medium">Field:</span> {booking.field_name}</div>
            <div><span className="font-medium">New Date:</span> {date.toISOString().split('T')[0]}</div>
            <div><span className="font-medium">Start:</span> {startTime || '—'}</div>
            <div><span className="font-medium">End:</span> {endTime || '—'}</div>
            <div><span className="font-medium">Duration:</span> {duration}h</div>
            <div><span className="font-medium">Estimated Cost:</span> {startTime ? `R${cost.toFixed(2)}` : '—'}</div>
          </div>
          <div className="flex items-end">
            <Button disabled={!startTime || updateMutation.isLoading} loading={updateMutation.isLoading} onClick={() => updateMutation.mutate()} className="w-full md:w-auto">Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModifyBookingPage;
