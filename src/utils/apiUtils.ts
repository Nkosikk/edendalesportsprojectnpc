// API utility functions for handling CORS and fallback requests

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Make API request with automatic fallback from proxy to direct
 */
export const makeApiRequest = async (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  headers?: Record<string, string>
) => {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  // Always use API_BASE_URL (proxy in dev, direct in prod)
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      headers: defaultHeaders,
      timeout: 15000,
    });
    return response;
  } catch (error: any) {
    console.error('API call failed:', error?.message || error);
    throw error;
  }
};

/**
 * Helper for POST requests
 */
export const apiPost = (endpoint: string, data: any, headers?: Record<string, string>) =>
  makeApiRequest('POST', endpoint, data, headers);

/**
 * Helper for GET requests
 */
export const apiGet = (endpoint: string, headers?: Record<string, string>) =>
  makeApiRequest('GET', endpoint, undefined, headers);

/**
 * Helper for PUT requests
 */
export const apiPut = (endpoint: string, data: any, headers?: Record<string, string>) =>
  makeApiRequest('PUT', endpoint, data, headers);

/**
 * Helper for DELETE requests
 */
export const apiDelete = (endpoint: string, headers?: Record<string, string>) =>
  makeApiRequest('DELETE', endpoint, undefined, headers);