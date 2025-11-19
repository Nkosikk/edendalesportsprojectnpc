import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, Clock, Star, ShieldAlert } from 'lucide-react';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { fieldService } from '../services/fieldsService';
import type { FieldAvailability, SportsField } from '../types';

const HomePage = () => {
  const navigate = useNavigate();
  const [fields, setFields] = useState<SportsField[]>([]);
  const [loadingFields, setLoadingFields] = useState<boolean>(true);
  const [allFieldsFallback, setAllFieldsFallback] = useState<boolean>(false);

  // Booking widget state
  const [selectedFieldId, setSelectedFieldId] = useState<number | ''>('');
  const [date, setDate] = useState<string>('');
  const [duration, setDuration] = useState<number>(1);
  const [availability, setAvailability] = useState<FieldAvailability | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState<boolean>(false);

  const toLocalDateInputValue = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toLocalDateInputValue(d);
  }, []);

  const maxDateStr = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 30);
    return toLocalDateInputValue(d);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingFields(true);
        let data = await fieldService.getAllFields(true);
        // If no active fields found, fall back to all fields (admin may not have activated yet)
        if (!data || data.length === 0) {
          data = await fieldService.getAllFields(false);
          setAllFieldsFallback(true);
        } else {
          setAllFieldsFallback(false);
        }
        setFields(data);
      } finally {
        setLoadingFields(false);
      }
    };
    load();
  }, []);

  const searchAvailability = async () => {
    if (!selectedFieldId || !date) return;
    try {
      setLoadingAvailability(true);
      const data = await fieldService.getFieldAvailability(Number(selectedFieldId), date, duration);
      setAvailability(data);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleBook = (slot: { start_time: string; end_time: string }) => {
    if (!selectedFieldId || !date) return;
    // Store booking intent for post-login restoration
    const bookingIntent = {
      field_id: Number(selectedFieldId),
      date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      timestamp: Date.now()
    };
    localStorage.setItem('pendingBooking', JSON.stringify(bookingIntent));
    
    const url = `/app/bookings/new?field_id=${selectedFieldId}&date=${date}&start_time=${slot.start_time}&end_time=${slot.end_time}`;
    // Navigate into protected route; ProtectedRoute will redirect to login if needed
    navigate(url);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary-50 to-blue-50 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-xl md:text-3xl font-bold text-gray-900 mb-2">
              Book Your Perfect <span className="text-primary-600">Sports Field 🚀</span>
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              Premium sports facilities at Edendale Sports Projects NPC. From football pitches to rugby fields.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Booking Section */}
      <section className="py-4 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Booking</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
                  {loadingFields ? (
                    <div className="h-10 flex items-center"><LoadingSpinner size="sm" /></div>
                  ) : (
                    <select
                      value={selectedFieldId}
                      onChange={(e) => setSelectedFieldId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Field</option>
                      {fields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {!loadingFields && fields.length === 0 && (
                    <p className="mt-1 text-xs text-error-600">No fields available. Please check back later.</p>
                  )}
                  {!loadingFields && allFieldsFallback && fields.length > 0 && (
                    <p className="mt-1 text-xs text-amber-600">Showing all fields (including inactive).</p>
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
                  <p className="mt-1 text-xs text-gray-500">Bookings allowed from today up to 30 days.</p>
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
                  <Button onClick={searchAvailability} className="w-full" disabled={!selectedFieldId || !date}>
                    Search
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                {loadingAvailability ? (
                  <div className="flex justify-center py-4"><LoadingSpinner /></div>
                ) : !availability ? (
                  <p className="text-gray-500 text-sm">Select options and click Search to view available and blocked slots.</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <h3 className="text-base font-semibold mb-2">Time Slots</h3>
                      {availability.slots.length === 0 ? (
                        <p className="text-gray-500">No available slots for the selected date.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {availability.slots.map((slot, idx) => (
                            <div key={idx} className={`border rounded-lg p-3 ${slot.available ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-medium text-sm text-gray-900">
                                  {slot.start_time} - {slot.end_time}
                                </div>
                                {!slot.available && (
                                  <span className="text-xs text-gray-500">Unavailable</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mb-2">R {slot.price.toFixed(2)}</div>
                              {slot.available ? (
                                <Button size="sm" onClick={() => handleBook(slot)} className="w-full">Book Now</Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-error-500"/> Blocked Slots</h3>
                      {availability.blocked_slots && availability.blocked_slots.length > 0 ? (
                        <ul className="space-y-2">
                          {availability.blocked_slots.map((b, i) => (
                            <li key={i} className="text-sm text-gray-700 bg-error-50 border border-error-100 rounded p-2">
                              {b.start_time} - {b.end_time} {b.reason ? `• ${b.reason}` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">No blocked slots on this date.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Our Fields Section */}
      <section className="py-4 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Our Available Fields</h2>
          {loadingFields ? (
            <div className="flex justify-center py-4"><LoadingSpinner /></div>
          ) : fields.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 font-medium mb-2">No active fields available at the moment.</p>
              <p className="text-amber-700 text-sm">Please check back later or contact us for more information about field availability.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fields.map((f) => (
                <Card key={f.id} className="hover:shadow-md transition-shadow border-l-4 border-l-primary-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="font-semibold">{f.name}</span>
                      <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs font-semibold">
                        R {f.hourly_rate.toFixed(2)}/hr
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900 w-16">Sport:</span> 
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{f.sport_type}</span>
                      </div>
                      {f.capacity && (
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 w-16">Capacity:</span> 
                          <span>{f.capacity} players</span>
                        </div>
                      )}
                      {f.facilities && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-900">Facilities:</span> 
                          <p className="text-gray-600 text-xs mt-1">{f.facilities}</p>
                        </div>
                      )}
                      {f.description && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-900">About:</span> 
                          <p className="text-gray-600 text-xs mt-1">{f.description}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Why Choose Edendale Sports?
            </h2>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              World-class sports facilities with modern amenities and professional service.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-primary-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Booking</h3>
              <p className="text-gray-600 text-sm">
                Book your preferred field in just a few clicks with our intuitive booking system.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <MapPin className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Prime Locations</h3>
              <p className="text-gray-600 text-sm">
                Strategically located fields with easy access and ample parking facilities.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Flexible Hours</h3>
              <p className="text-gray-600 text-sm">
                Extended operating hours to accommodate your schedule, from early morning to late evening.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Star className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Quality Facilities</h3>
              <p className="text-gray-600 text-sm">
                Well-maintained fields with modern facilities, changing rooms, and equipment.
              </p>
            </div>
          </div>
        </div>
      </section>



      {/* CTA Section */}
      <section className="bg-primary-600 py-6">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-white mb-2">
            Ready to Book Your Next Game?
          </h2>
          <p className="text-base text-primary-100 mb-4">
            Join thousands of athletes who trust Edendale Sports.
          </p>
          <Link to="/register">
            <Button variant="secondary" size="lg">
              Create Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;