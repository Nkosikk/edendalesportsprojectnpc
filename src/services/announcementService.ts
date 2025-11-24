import apiClient, { handleApiResponse } from '../lib/api';
import type { Announcement } from '../types';

const normalizeAnnouncement = (payload: any): Announcement => {
  const message = (payload?.message ?? payload?.text ?? payload?.content ?? '').toString();
  const activeRaw = payload?.active ?? payload?.is_active ?? payload?.enabled ?? payload?.status ?? payload?.visible;
  const active = !!(activeRaw === true || activeRaw === 1 || activeRaw === '1' || activeRaw === 'active' || activeRaw === 'enabled');
  const updatedAt = payload?.updated_at ?? payload?.updatedAt ?? payload?.timestamp ?? new Date().toISOString();
  return {
    message,
    active,
    updated_at: updatedAt,
    updatedAt,
  };
};

const silentErrorHeaders = { 'X-Suppress-Error-Toast': '1' } as const;

const handleResponse = async (promise: Promise<any>) => {
  const response = await promise;
  try {
    return handleApiResponse<any>(response);
  } catch (error) {
    return response?.data?.data ?? response?.data ?? {};
  }
};

const fetchCandidates = ['/announcement', '/announcements/current', '/public/announcement'];
const publishCandidates = ['/admin/announcement', '/announcement', '/announcements'];

export const announcementService = {
  async fetchCurrent(): Promise<Announcement> {
    let lastError: unknown = null;
    for (const path of fetchCandidates) {
      try {
        const payload = await handleResponse(
          apiClient.get(path, {
            headers: silentErrorHeaders,
          })
        );
        return normalizeAnnouncement(payload);
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    console.warn('announcementService.fetchCurrent failed to reach backend:', lastError);
    return normalizeAnnouncement({ message: '', active: false });
  },

  async publish(payload: { message: string; active: boolean }): Promise<Announcement> {
    const body = {
      message: payload.message,
      active: payload.active ? 1 : 0,
      is_active: payload.active ? 1 : 0,
      enabled: payload.active,
    };
    let lastError: unknown = null;
    for (const path of publishCandidates) {
      try {
        const data = await handleResponse(
          apiClient.post(path, body, {
            headers: silentErrorHeaders,
          })
        );
        return normalizeAnnouncement(data);
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    console.error('announcementService.publish failed:', lastError);
    throw lastError instanceof Error ? lastError : new Error('Failed to publish announcement');
  },
};

export default announcementService;
