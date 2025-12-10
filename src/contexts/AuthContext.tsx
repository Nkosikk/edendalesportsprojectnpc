import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { User, UserRole, LoginRequest, RegisterRequest, ApiResponse, AuthResponse } from '../types';
import { apiClient, handleApiResponse } from '../lib/api';
import toast from 'react-hot-toast';

// Inactivity timeout in milliseconds (15 minutes)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
// Warning before logout (1 minute before timeout)
const WARNING_BEFORE_LOGOUT = 60 * 1000;

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  requireRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningShownRef = useRef(false);

  // Logout function (defined early so it can be used by inactivity handler)
  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    // Clear inactivity timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    warningShownRef.current = false;
    toast.success('Logged out successfully');
  }, []);

  // Handle inactivity logout with automatic redirect
  const handleInactivityLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    // Clear timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    warningShownRef.current = false;
    toast.error('Session expired due to inactivity. Please log in again.', { duration: 5000 });
    // Automatically redirect to login page
    window.location.href = '/login';
  }, []);

  // Reset inactivity timer on user activity
  const resetInactivityTimer = useCallback(() => {
    // Only track activity if user is logged in
    if (!localStorage.getItem('accessToken')) return;

    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    warningShownRef.current = false;

    // Set warning timer (fires 1 minute before logout)
    warningTimerRef.current = setTimeout(() => {
      if (!warningShownRef.current && localStorage.getItem('accessToken')) {
        warningShownRef.current = true;
        toast('Your session will expire in 1 minute due to inactivity.', {
          icon: '⚠️',
          duration: 10000,
          id: 'inactivity-warning',
        });
      }
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);

    // Set logout timer
    inactivityTimerRef.current = setTimeout(() => {
      if (localStorage.getItem('accessToken')) {
        handleInactivityLogout();
      }
    }, INACTIVITY_TIMEOUT);
  }, [handleInactivityLogout]);

  // Set up activity listeners
  useEffect(() => {
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel',
    ];

    // Throttle activity reset to avoid excessive timer resets
    let lastActivity = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      // Only reset if more than 1 second has passed since last reset
      if (now - lastActivity > 1000) {
        lastActivity = now;
        resetInactivityTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, throttledReset, { passive: true });
    });

    // Also listen for visibility change (user switches back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('accessToken')) {
        resetInactivityTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start inactivity timer if user is already logged in
    if (localStorage.getItem('accessToken')) {
      resetInactivityTimer();
    }

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledReset);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, [resetInactivityTimer]);

  useEffect(() => {
    // Check if user is logged in on app start
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');

      if (storedUser && accessToken) {
        try {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          // Optionally verify token is still valid
          await apiClient.get('/auth/verify');
        } catch (error) {
          // Token invalid, clear storage and user state
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setLoading(true);
      // Use absolute path to backend (CORS enabled)
      const response = await apiClient.post<AuthResponse>(
        '/auth/login',
        {
          email: credentials.email,
          password: credentials.password,
        },
        {
          suppressErrorToast: true,
        } as any
      );

      if (!response.data.success) throw new Error('Login failed');
      const { user: userData, token } = response.data.data;

      // Store token and user data
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      toast.success('Login successful!');

      // Check for pending booking and redirect if found
      const pendingBooking = localStorage.getItem('pendingBooking');
      if (pendingBooking) {
        try {
          const booking = JSON.parse(pendingBooking);
          const { field_id, date, start_time, end_time, duration: pendingDuration } = booking || {};
          localStorage.removeItem('pendingBooking');
          if (field_id && date && start_time && end_time) {
            const params = new URLSearchParams({
              field_id: String(field_id),
              date,
              start_time,
              end_time,
            });
            if (pendingDuration) {
              params.set('duration', String(pendingDuration));
            }
            window.location.href = `/app/bookings/new?${params.toString()}`;
          }
        } catch (e) {
          console.warn('Failed to parse pending booking:', e);
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      // Only show toast if not already shown by interceptor
      if (!(error as any)._toastShown) {
        toast.error(message);
      }
      throw error;
    } finally {
      setLoading(false);
      // Start inactivity timer after successful login
      if (localStorage.getItem('accessToken')) {
        resetInactivityTimer();
      }
    }
  };

  const register = async (userData: RegisterRequest) => {
    try {
      setLoading(true);
      // Automatically set role to customer for all registrations
      const registrationData = { ...userData, role: 'customer' };
      const response = await apiClient.post<AuthResponse>('/auth/register', registrationData);
      if (!response.data.success) throw new Error('Registration failed');
      const { user: newUser, token } = response.data.data;

      // Store token and user data
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      setUser(newUser);
      toast.success('Registration successful!');

      // Start inactivity timer after successful registration
      resetInactivityTimer();

      // Check for pending booking and redirect if found
      const pendingBooking = localStorage.getItem('pendingBooking');
      if (pendingBooking) {
        try {
          const booking = JSON.parse(pendingBooking);
          const { field_id, date, start_time, end_time, duration: pendingDuration } = booking || {};
          localStorage.removeItem('pendingBooking');
          if (field_id && date && start_time && end_time) {
            const params = new URLSearchParams({
              field_id: String(field_id),
              date,
              start_time,
              end_time,
            });
            if (pendingDuration) {
              params.set('duration', String(pendingDuration));
            }
            setTimeout(() => {
              window.location.href = `/app/bookings/new?${params.toString()}`;
            }, 300);
          }
        } catch (e) {
          console.warn('Failed to parse pending booking:', e);
          localStorage.removeItem('pendingBooking');
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      const response = await apiClient.put<ApiResponse<User>>('/auth/profile', userData);
      const updatedUser = handleApiResponse(response) as User;
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
      throw error;
    }
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role as UserRole);
  };

  const requireRole = (roles: UserRole[]) => {
    return hasRole(...roles);
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    updateProfile,
    loading,
    isAuthenticated: !!user,
    hasRole,
    requireRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};