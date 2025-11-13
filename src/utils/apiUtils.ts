// API utility functions for handling CORS and fallback requests

import axios from 'axios';

const DIRECT_API_URL = 'https://www.ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC/api';
const PROXY_API_URL = '/api';

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

  // First try with proxy
  try {
    console.log(`Trying proxy request: ${method} ${PROXY_API_URL}${endpoint}`);
    const response = await axios({
      method,
      url: `${PROXY_API_URL}${endpoint}`,
      data,
      headers: defaultHeaders,
      timeout: 10000,
    });
    return response;
  } catch (proxyError: any) {
    console.log('Proxy request failed, trying direct API call:', proxyError?.message || proxyError);
    
    // Fallback to direct API call
    try {
      console.log(`Trying direct request: ${method} ${DIRECT_API_URL}${endpoint}`);
      const response = await axios({
        method,
        url: `${DIRECT_API_URL}${endpoint}`,
        data,
        headers: defaultHeaders,
        timeout: 15000,
      });
      return response;
    } catch (directError: any) {
      console.error('Both proxy and direct API calls failed:', {
        proxy: proxyError?.message || proxyError,
        direct: directError?.message || directError,
      });
      throw directError;
    }
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