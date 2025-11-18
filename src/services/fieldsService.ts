import apiClient, { handleApiResponse } from '../lib/api';
import type {
  SportsField,
  FieldAvailability,
  CreateFieldRequest,
  ApiResponse,
} from '../types';

/**
 * Sports Field Service
 * Handles field management and availability checking
 */

export const fieldService = {
  /**
   * Get all sports fields
   */
  getAllFields: async (activeOnly = true): Promise<SportsField[]> => {
    const response = await apiClient.get<ApiResponse<SportsField[]>>('/fields', {
      params: { active_only: activeOnly },
    });
    return handleApiResponse<SportsField[]>(response);
  },

  /**
   * Get field by ID
   */
  getFieldById: async (id: number): Promise<SportsField> => {
    const response = await apiClient.get<ApiResponse<SportsField>>(`/fields/${id}`);
    return handleApiResponse<SportsField>(response);
  },

  /**
   * Get field availability for a specific date
   */
  getFieldAvailability: async (
    fieldId: number,
    date: string,
    duration = 1
  ): Promise<FieldAvailability> => {
    const response = await apiClient.get<ApiResponse<FieldAvailability>>(
      `/fields/${fieldId}/availability`,
      {
        params: { date, duration },
      }
    );
    return handleApiResponse<FieldAvailability>(response);
  },

  /**
   * Create a new field (Admin only)
   */
  createField: async (data: CreateFieldRequest): Promise<SportsField> => {
    const response = await apiClient.post<ApiResponse<SportsField>>('/fields', data);
    return handleApiResponse<SportsField>(response);
  },

  /**
   * Update a field (Admin only)
   */
  updateField: async (id: number, data: Partial<CreateFieldRequest>): Promise<SportsField> => {
    const response = await apiClient.put<ApiResponse<SportsField>>(`/fields/${id}`, data);
    return handleApiResponse<SportsField>(response);
  },

  /**
   * Delete/deactivate a field (Admin only)
   */
  deleteField: async (id: number): Promise<void> => {
    const response = await apiClient.delete<ApiResponse>(`/fields/${id}`);
    return handleApiResponse<void>(response);
  },

  /**
   * Activate a field (Admin only)
   */
  activateField: async (id: number): Promise<SportsField> => {
    const response = await apiClient.put<ApiResponse<SportsField>>(`/fields/${id}/activate`);
    return handleApiResponse<SportsField>(response);
  },

  /**
   * Deactivate a field (Admin only)
   */
  deactivateField: async (id: number): Promise<SportsField> => {
    const response = await apiClient.put<ApiResponse<SportsField>>(`/fields/${id}/deactivate`);
    return handleApiResponse<SportsField>(response);
  },
};

export default fieldService;
