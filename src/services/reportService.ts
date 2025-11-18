import apiClient, { handleApiResponse } from '../lib/api';
import type {
  RevenueReport,
  BookingAnalytics,
  ReportFilters,
  ExportReportParams,
  ApiResponse,
} from '../types';

/**
 * Reports Service
 * Handles analytics, reporting, and export functionality
 */

export const reportService = {
  /**
   * Get revenue report
   */
  getRevenueReport: async (filters?: ReportFilters): Promise<RevenueReport> => {
    const response = await apiClient.get<ApiResponse<RevenueReport>>('/reports/revenue', {
      params: filters,
    });
    return handleApiResponse<RevenueReport>(response);
  },

  /**
   * Get booking analytics
   */
  getBookingAnalytics: async (filters?: ReportFilters): Promise<BookingAnalytics> => {
    const response = await apiClient.get<ApiResponse<BookingAnalytics>>('/reports/analytics', {
      params: filters,
    });
    return handleApiResponse<BookingAnalytics>(response);
  },

  /**
   * Export report to file
   * This will download the file directly
   */
  exportReport: async (params: ExportReportParams): Promise<void> => {
    const response = await apiClient.get('/reports/export', {
      params,
      responseType: 'blob', // Important for file download
    });

    // Create a blob URL and trigger download
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename based on type and format
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = params.format === 'csv' ? 'csv' : params.format === 'excel' ? 'xls' : 'html';
    link.download = `${params.type}_report_${timestamp}.${extension}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

export default reportService;
