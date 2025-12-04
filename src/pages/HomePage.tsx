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

  // Filter out past time slots for today's date
  const filterAvailableSlots = (slots: any[]) => {
    if (!date || !slots) return slots;
    
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    // Only filter if selected date is today
    if (selectedDate.getTime() !== today.getTime()) {
      return slots;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    return slots.filter(slot => {
      const [startHour, startMinute] = slot.start_time.split(':').map(Number);
      const slotStartTime = startHour * 60 + startMinute;
      const currentTime = currentHour * 60 + currentMinute;
      
      // Show slot if it starts at least 30 minutes from now
      return slotStartTime > currentTime + 30;
    });
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Book Your Perfect <span className="text-primary-600">Sports Field 🚀</span>
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto">
              Premium sports facilities at Edendale Sports Projects NPC.
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
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Field</label>
                    {loadingFields ? (
                      <div className="h-10 flex items-center"><LoadingSpinner size="sm" /></div>
                    ) : (
                      <select
                        value={selectedFieldId}
                        onChange={(e) => setSelectedFieldId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select Field</option>
                        {fields.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} - R{Number(f.hourly_rate || 0).toFixed(0)}/hr
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={todayStr}
                      max={maxDateStr}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {[1,2,3,4].map((d) => <option key={d} value={d}>{d} hour{d > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <Button 
                      onClick={searchAvailability} 
                      className="w-full py-2.5 font-semibold" 
                      disabled={!selectedFieldId || !date}
                      size="lg"
                    >
                      🔍 Search Slots
                    </Button>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-xs text-gray-500">💡 Select your field and date to see available time slots • Bookings up to 30 days in advance</p>
                </div>
              </div>

              <div className="mt-4">
                {loadingAvailability ? (
                  <div className="flex justify-center py-4"><LoadingSpinner /></div>
                ) : !availability ? (
                  <p className="text-gray-500 text-sm">Select options and click Search to view available and blocked slots.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <h3 className="text-base font-semibold mb-2">Time Slots</h3>
                      {(() => {
                        const filteredSlots = filterAvailableSlots(availability.slots);
                        return filteredSlots.length === 0 ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-amber-800 font-medium">No available slots for the selected date and time.</p>
                            <p className="text-amber-700 text-sm mt-1">
                              {date === todayStr 
                                ? "Try selecting a future date or check back tomorrow for more availability."
                                : "Please try a different date or contact us for assistance."}
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredSlots.map((slot, idx) => (
                            <div key={idx} className={`border-2 rounded-xl p-4 transition-all ${
                              slot.available 
                                ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100 hover:shadow-md' 
                                : 'border-gray-200 bg-gray-50 opacity-60'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-bold text-gray-900">
                                  {slot.start_time} - {slot.end_time}
                                </div>
                                {!slot.available && (
                                  <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs font-medium">Unavailable</span>
                                )}
                              </div>
                              <div className="text-lg font-semibold text-primary-600 mb-3">R {Number(slot.price || 0).toFixed(2)}</div>
                              {slot.available ? (
                                <Button size="sm" onClick={() => handleBook(slot)} className="w-full font-semibold">
                                  ⚡ Book This Slot
                                </Button>
                              ) : (
                                <div className="w-full py-2 text-center text-xs text-gray-500 font-medium">
                                  Not Available
                                </div>
                              )}
                            </div>
                            ))}
                          </div>
                        );
                      })()}
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

      {/* Browse Our Fields Section */}
      <section className="py-6 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">🏟️ Browse Our Premium Fields</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Explore our world-class sports facilities. Each field is professionally maintained with modern amenities.</p>
          </div>
          {loadingFields ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : fields.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <div className="text-4xl mb-4">🏗️</div>
              <p className="text-gray-800 font-medium mb-2">Fields Coming Soon!</p>
              <p className="text-gray-600 text-sm">We're preparing amazing sports facilities for you. Check back soon!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fields.slice(0, 4).map((f) => (
                  <Card key={f.id} className="hover:shadow-lg transition-all duration-200 border-0 bg-white overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{f.name}</h3>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                              {f.sport_type}
                            </span>
                            {f.capacity && (
                              <span className="text-gray-500 text-sm">• {f.capacity} players</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="bg-primary-100 text-primary-700 px-3 py-2 rounded-lg">
                            <div className="text-lg font-bold">R{Number(f.hourly_rate || 0).toFixed(0)}</div>
                            <div className="text-xs">per hour</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {f.facilities && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-700 mb-1">🏢 FACILITIES</div>
                            <p className="text-sm text-gray-600">{f.facilities}</p>
                          </div>
                        )}
                        {f.description && (
                          <div className="bg-green-50 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-700 mb-1">ℹ️ ABOUT THIS FIELD</div>
                            <p className="text-sm text-gray-600">{f.description}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {fields.length > 4 && (
                <div className="text-center mt-6">
                  <p className="text-gray-600 mb-3">Plus {fields.length - 4} more field{fields.length - 4 > 1 ? 's' : ''} available</p>
                  <Link to="/app/fields">
                    <Button variant="outline" className="px-6">
                      View All Fields →
                    </Button>
                  </Link>
                </div>
              )}
              
              <div className="mt-8 bg-primary-50 border border-primary-200 rounded-xl p-6 text-center">
                <div className="text-2xl mb-2">⚡</div>
                <h3 className="text-lg font-semibold text-primary-900 mb-2">Ready to Book?</h3>
                <p className="text-primary-700 text-sm mb-4">Use the Quick Booking section above to check availability and secure your field!</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link to="/register">
                    <Button size="sm" className="px-4">
                      🏃‍♂️ Sign Up Now
                    </Button>
                  </Link>
                  <Link to="/app/fields">
                    <Button variant="outline" size="sm" className="px-4">
                      🔍 Browse All Fields
                    </Button>
                  </Link>
                </div>
              </div>
            </>
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