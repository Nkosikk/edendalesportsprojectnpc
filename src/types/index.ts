export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: 'USER' | 'ADMIN' | 'MANAGER';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Field {
  id: string;
  name: string;
  description?: string;
  location: string;
  type: 'FOOTBALL' | 'RUGBY' | 'CRICKET' | 'MULTI_PURPOSE';
  capacity: number;
  hourlyRate: number;
  facilities: string[];
  availability: FieldAvailability[];
  isActive: boolean;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FieldAvailability {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface Booking {
  id: string;
  userId: string;
  fieldId: string;
  startDateTime: string;
  endDateTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  totalAmount: number;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  purpose: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  notes?: string;
  field?: Field;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  paymentMethod: 'CARD' | 'BANK_TRANSFER' | 'CASH';
  transactionId?: string;
  paymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface CreateBookingRequest {
  fieldId: string;
  startDateTime: string;
  endDateTime: string;
  purpose: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  notes?: string;
}

export interface UpdateBookingRequest {
  startDateTime?: string;
  endDateTime?: string;
  purpose?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
}

export interface FieldSearchFilters {
  type?: string;
  location?: string;
  capacity?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  maxRate?: number;
}

export interface BookingFilters {
  status?: string;
  fieldId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}