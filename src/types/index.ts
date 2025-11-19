// ===== Core Domain Types (Matching API Schema) =====

export enum UserRole {
  Admin = 'admin',
  Staff = 'staff',
  Customer = 'customer'
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: UserRole | 'admin' | 'staff' | 'customer';
  is_active: boolean;
  email_verified?: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
}

export interface SportsField {
  id: number;
  name: string;
  description?: string;
  sport_type: 'football' | 'netball' | 'basketball' | 'tennis' | 'multipurpose';
  capacity: number;
  hourly_rate: number;
  facilities: string;
  rules?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingDetails {
  id: number;
  booking_reference: string;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  field_id: number;
  field_name: string;
  sport_type: 'football' | 'netball' | 'basketball' | 'tennis' | 'multipurpose';
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  hourly_rate: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentResponse {
  payment_id: number;
  payment_reference: string;
  gateway_url?: string;
  gateway_data?: Record<string, any>;
  booking: {
    id: number;
    reference: string;
    amount: number;
    field_name: string;
    booking_date: string;
    start_time: string;
    end_time: string;
  };
}

export interface PaymentStatus {
  payment: {
    id: number;
    payment_reference: string;
    booking_reference: string;
    payment_method: 'online' | 'eft' | 'cash' | 'card';
    amount: number;
    currency: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
    processed_at?: string;
    created_at: string;
  };
}

export interface FieldAvailability {
  field: {
    id: number;
    name: string;
    field_type: 'football' | 'netball' | 'basketball' | 'tennis' | 'multipurpose';
    hourly_rate: number;
  };
  date: string;
  duration_hours: number;
  operating_hours: {
    start_time: string;
    end_time: string;
  };
  slots: Array<{
    start_time: string;
    end_time: string;
    available: boolean;
    price: number;
  }>;
  blocked_slots?: Array<{
    start_time: string;
    end_time: string;
    status: 'blocked' | 'maintenance' | 'event';
    reason?: string;
  }>;
}

// ===== Admin & Dashboard Types =====

export interface DashboardData {
  period: {
    from_date: string;
    to_date: string;
  };
  summary: {
    total_bookings: number;
    total_hours: number;
    total_revenue: number;
    confirmed_bookings: number;
    cancelled_bookings: number;
    pending_payments: number;
    total_users: number;
  };
  recent_bookings: BookingDetails[];
  field_utilization: Array<{
    field: SportsField;
    stats: Record<string, any>;
  }>;
  daily_revenue: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
}

export interface RevenueReport {
  period: {
    from_date: string;
    to_date: string;
  };
  overall_stats: {
    total_bookings: number;
    total_hours: number;
    total_revenue: number;
    average_booking_value: number;
    confirmation_rate: number;
  };
  revenue_timeline: Array<{
    period: string;
    bookings: number;
    revenue: number;
    total_hours: number;
  }>;
  payment_methods: Array<{
    payment_method: string;
    total_payments: number;
    total_amount: number;
  }>;
  field_revenue: Array<any>;
  top_customers: Array<any>;
}

export interface BookingAnalytics {
  period: {
    from_date: string;
    to_date: string;
    total_days: number;
  };
  overall_stats: {
    total_bookings: number;
    total_hours: number;
    total_revenue: number;
    confirmed_bookings: number;
    cancelled_bookings: number;
    confirmation_rate: number;
    average_booking_value: number;
  };
  booking_trends: Array<{
    date: string;
    total_bookings: number;
    confirmed_bookings: number;
    cancelled_bookings: number;
    paid_bookings: number;
  }>;
  peak_hours: Array<{
    hour: number;
    bookings: number;
    revenue: number;
  }>;
  field_utilization: Array<{
    id: number;
    field_name: string;
    sport_type: string;
    total_bookings: number;
    booked_hours: number;
    available_hours_period: number;
    utilization_percentage: number;
  }>;
  status_distribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  cancellation_stats: {
    total_bookings: number;
    cancelled_bookings: number;
    customer_cancellations: number;
    admin_cancellations: number;
    cancellation_rate: number;
    avg_hours_before_cancellation: number;
  };
  duration_analysis: Array<{
    duration_category: string;
    bookings: number;
    avg_amount: number;
    total_amount: number;
  }>;
}

// ===== API Response Types =====

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  timestamp: string;
  errors?: Record<string, string>;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
  timestamp: string;
}

// ===== Request Types =====

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
  role?: 'customer';
}

export interface CreateBookingRequest {
  field_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface UpdateBookingRequest {
  booking_date?: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
}

export interface CreateFieldRequest {
  name: string;
  description?: string;
  sport_type: 'football' | 'netball' | 'basketball' | 'tennis' | 'multipurpose';
  capacity: number;
  hourly_rate: number;
  facilities: string;
  rules?: string;
}

export interface CreatePaymentRequest {
  booking_id: number;
  payment_method: 'online' | 'eft' | 'cash' | 'card';
  notes?: string;
}

export interface BlockSlotRequest {
  field_id: number;
  date: string;
  start_time: string;
  end_time: string;
  reason?: string;
}

export interface UpdateUserRoleRequest {
  role: 'admin' | 'staff' | 'customer';
  reason?: string;
}

export interface UpdateUserStatusRequest {
  is_active: boolean;
  reason?: string;
}

export interface UpdateBookingStatusRequest {
  booking_id: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  reason?: string;
  refund_amount?: number;
}

// ===== Filter Types =====

export interface BookingFilters {
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface AdminBookingFilters {
  field_id?: number;
  status?: string;
  payment_status?: string;
  user_search?: string;
}

export interface UserFilters {
  role?: 'admin' | 'staff' | 'customer';
  search?: string;
}

export interface ReportFilters {
  from_date?: string;
  to_date?: string;
  field_id?: number;
  group_by?: 'day' | 'week' | 'month';
}

export interface ExportReportParams {
  type: 'bookings' | 'revenue' | 'payments';
  format: 'csv' | 'excel' | 'pdf';
  from_date?: string;
  to_date?: string;
}