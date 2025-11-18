import axios, { AxiosInstance, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

// API Configuration
// In development, use Vite proxy at '/api' to avoid CORS.
// In production, call the real backend URL directly.
const API_BASE_URL = import.meta.env.MODE === 'development'
  ? '/api'
  : 'https://www.ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC/api';

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

    // Handle 401 errors (unauthorized) - no refresh flow in backend
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (originalRequest) originalRequest._retry = true;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      // Redirect to login
      window.location.href = '/login';
      return Promise.reject(error);
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
export const handleApiResponse = <T>(response: AxiosResponse, showSuccessToast: boolean = false): T => {
  if (response.data.success) {
    // Only show success toast when explicitly requested (for important actions like registration, login, etc.)
    if (showSuccessToast && response.data.message) {
      toast.success(response.data.message);
    }
    return response.data.data;
  } else {
    throw new Error(response.data.message || 'API request failed');
  }
};

export default apiClient;