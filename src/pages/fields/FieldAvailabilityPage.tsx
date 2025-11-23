import React, { useEffect, useState } from 'react';
import { fieldService } from '../../services/fieldsService';
import type { SportsField, FieldAvailability } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

const FieldAvailabilityPage: React.FC = () => {
  const [fields, setFields] = useState<SportsField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<number | ''>('');
  const [date, setDate] = useState<string>('');
  const [duration, setDuration] = useState<number>(1);
  const [availability, setAvailability] = useState<FieldAvailability | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFields, setLoadingFields] = useState<boolean>(true);

  const loadFields = async () => {
    try {
      setLoadingFields(true);
      const data = await fieldService.getAllFields(true);
      console.log('Loaded fields (active only):', data);
      setFields(data);
    } catch (error) {
      console.error('Failed to load fields:', error);
      setFields([]); // Set empty array on error
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  const searchAvailability = async () => {
    if (!selectedFieldId || !date) return;
    try {
      setLoading(true);
      const data = await fieldService.getFieldAvailability(Number(selectedFieldId), date, duration);
      setAvailability(data);
    } finally {
      setLoading(false);
    }
  };

  const toLocalDateInputValue = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = (() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return toLocalDateInputValue(d);
  })();
  const maxDateStr = (() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 30);
    return toLocalDateInputValue(d);
  })();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Check Field Availability</h1>
          <p className="text-gray-600">Select a field, date, and duration to view available time slots.</p>
        </div>
        <Button variant="outline" onClick={loadFields} disabled={loadingFields}>
          {loadingFields ? 'Loading...' : 'Refresh Fields'}
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
              {loadingFields ? (
                <div className="h-10 flex items-center"><LoadingSpinner size="sm" /></div>
              ) : (
                <>
                  <select
                    value={selectedFieldId}
                    onChange={(e) => setSelectedFieldId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Field</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.sport_type})
                      </option>
                    ))}
                  </select>
                  {fields.length === 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-red-600 mt-1">No fields available. Please check back later.</p>
                      <Button size="sm" variant="outline" onClick={loadFields} className="mt-1">
                        Refresh
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={todayStr}
                max={maxDateStr}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {[1,2,3,4].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={searchAvailability} className="w-full">
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Slots</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><LoadingSpinner /></div>
          ) : !availability ? (
            <p className="text-gray-500">Select options and click Search to view slots.</p>
          ) : availability.slots.length === 0 ? (
            <p className="text-gray-500">No available slots for the selected date.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availability.slots.map((slot, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-gray-900">
                        {slot.start_time} - {slot.end_time}
                      </div>
                      <div className="text-sm text-gray-500">R {Number(slot.price || 0).toFixed(2)}</div>
                    </div>
                    {slot.available ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          // Navigate to booking creation with pre-filled values
                          window.location.href = `/app/bookings/new?field_id=${selectedFieldId}&date=${date}&start_time=${slot.start_time}&end_time=${slot.end_time}`;
                        }}
                      >
                        Book
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-400">Unavailable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FieldAvailabilityPage;
