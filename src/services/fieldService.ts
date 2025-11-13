import { apiClient, handleApiResponse } from '../lib/api';
import { 
  Field, 
  FieldSearchFilters, 
  ApiResponse, 
  PaginatedResponse 
} from '../types';

export const fieldService = {
  // Get all fields with optional filters
  getFields: async (filters?: FieldSearchFilters) => {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.location) params.append('location', filters.location);
    if (filters?.capacity) params.append('capacity', filters.capacity.toString());
    if (filters?.date) params.append('date', filters.date);
    if (filters?.startTime) params.append('startTime', filters.startTime);
    if (filters?.endTime) params.append('endTime', filters.endTime);
    if (filters?.maxRate) params.append('maxRate', filters.maxRate.toString());

    const response = await apiClient.get<ApiResponse<PaginatedResponse<Field>>>(
      `/fields?${params.toString()}`
    );
    return handleApiResponse<PaginatedResponse<Field>>(response);
  },

  // Get field by ID
  getField: async (id: string) => {
    const response = await apiClient.get<ApiResponse<Field>>(`/fields/${id}`);
    return handleApiResponse<Field>(response);
  },

  // Check field availability
  checkAvailability: async (fieldId: string, startDateTime: string, endDateTime: string) => {
    const response = await apiClient.get<ApiResponse<{ available: boolean }>>(
      `/fields/${fieldId}/availability`,
      {
        params: {
          startDateTime,
          endDateTime,
        },
      }
    );
    return handleApiResponse<{ available: boolean }>(response);
  },

  // Admin endpoints
  createField: async (fieldData: Omit<Field, 'id' | 'createdAt' | 'updatedAt'>) => {
    const response = await apiClient.post<ApiResponse<Field>>('/admin/fields', fieldData);
    return handleApiResponse<Field>(response);
  },

  updateField: async (id: string, fieldData: Partial<Field>) => {
    const response = await apiClient.put<ApiResponse<Field>>(`/admin/fields/${id}`, fieldData);
    return handleApiResponse<Field>(response);
  },

  deleteField: async (id: string) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/admin/fields/${id}`);
    return handleApiResponse<void>(response);
  },
};