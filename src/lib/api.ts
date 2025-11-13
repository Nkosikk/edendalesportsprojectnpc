import axios, { AxiosInstance, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

// API Configuration - Use proxy to avoid CORS issues
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', {
            refreshToken,
          });
          
          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeValue('user');
        window.location.href = '/login';
      }
    }

    // Handle CORS errors specifically
    if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
      toast.error('Network error. Please check your connection and try again.');
      console.error('CORS Error:', error);
      return Promise.reject(new Error('Network connectivity issue'));
    }

    // Handle other errors
    // Only show error toast if not a handled success (status not 2xx or success false)
    const isSuccess = error.response?.data?.success;
    const status = error.response?.status;
    const message = error.response?.data?.message;
    const errorMessage = message || 'An error occurred';
    // Don't show toast for 401 errors as we handle them above
    const isRegistrationSuccess =
      status >= 200 && status < 300 && isSuccess && message && message.toLowerCase().includes('registration successful');
    if (status !== 401 && !isRegistrationSuccess && !(status >= 200 && status < 300 && isSuccess)) {
      toast.error(errorMessage);
    }
    return Promise.reject(error);
  }
);

// API response wrapper
export const handleApiResponse = <T>(response: AxiosResponse): T => {
  if (response.data.success) {
    // If a message is present, show it as a toast (for registration, etc.)
    if (response.data.message) {
      toast.success(response.data.message);
    }
    return response.data.data;
  } else {
    throw new Error(response.data.message || 'API request failed');
  }
};

export default apiClient;