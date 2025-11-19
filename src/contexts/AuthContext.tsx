import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, LoginRequest, RegisterRequest, ApiResponse, AuthResponse } from '../types';
import { apiClient, handleApiResponse } from '../lib/api';
import toast from 'react-hot-toast';

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

  useEffect(() => {
    // Check if user is logged in on app start
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');

      if (storedUser && accessToken) {
        try {
          setUser(JSON.parse(storedUser));
          // Optionally verify token is still valid
          await apiClient.get('/auth/verify');
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          // no refresh token in current API
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
        }
      );

      if (!response.data.success) throw new Error('Login failed');
      const { user: userData, token } = response.data.data;

      // Store token and user data
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      toast.success('Login successful!');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
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
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    // no refresh token in current API
    toast.success('Logged out successfully');
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