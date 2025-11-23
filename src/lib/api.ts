import axios, { AxiosInstance, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

// API Configuration
// Use the real backend URL directly (supports CORS)
const API_BASE_URL = 'https://www.ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC/api';

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
    // Bust caches on GET requests to ensure latest booking/payment data
    if ((config.method || 'get').toLowerCase() === 'get') {
      config.params = {
        ...(config.params || {}),
        _ts: Date.now(),
      };
    }
    const token = localStorage.getItem('accessToken');
    // Do not attach Authorization for login/register endpoints
    const path = (config.url || '').toLowerCase();
    const isAuthEndpoint = path.includes('/auth/login') || path.includes('/auth/register');
    if (token && !isAuthEndpoint) {
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
      // Allow callers to suppress toast, e.g., for batch background calls
      const suppressToast = originalRequest?.headers?.['X-Suppress-Error-Toast'];
      if (!suppressToast) {
        toast.error('Network error. Please check your connection and try again.');
      }
      console.error('CORS Error:', error);
      return Promise.reject(new Error('Network connectivity issue'));
    }

    // Handle other errors
    // Only show error toast if not a handled success (status not 2xx or success false)
    // Allow callers to suppress error toasts explicitly
    const suppressToast = originalRequest?.headers?.['X-Suppress-Error-Toast'];
    const isSuccess = error.response?.data?.success;
    const status = error.response?.status;
    const message = error.response?.data?.message;
    const errorMessage = message || 'An error occurred';
    // Don't show toast for 401 errors as we handle them above
    const isRegistrationSuccess =
      status >= 200 && status < 300 && isSuccess && message && message.toLowerCase().includes('registration successful');
    if (!suppressToast && status !== 401 && !isRegistrationSuccess && !(status >= 200 && status < 300 && isSuccess)) {
      // Deduplicate error toasts: mark error so downstream handlers can skip
      if (!(error as any)._toastShown) {
        toast.error(errorMessage, { id: `err-${status || 'generic'}-${errorMessage}` });
        (error as any)._toastShown = true;
      }
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