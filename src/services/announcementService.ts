import apiClient, { handleApiResponse } from '../lib/api';
import type { Announcement } from '../types';

type SaveAnnouncementPayload = {
  id?: number;
  title: string;
  message: string;
  type?: Announcement['type'];
  target_audience?: Announcement['target_audience'];
  is_active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
};

const normalizeAnnouncement = (payload: any): Announcement => {
  const message = (payload?.message ?? payload?.text ?? payload?.content ?? '').toString();
  const activeRaw = payload?.active ?? payload?.is_active ?? payload?.enabled ?? payload?.status ?? payload?.visible;
  const isActive = !!(activeRaw === true || activeRaw === 1 || activeRaw === '1' || activeRaw === 'active' || activeRaw === 'enabled');
  const updatedAt = payload?.updated_at ?? payload?.updatedAt ?? payload?.timestamp ?? new Date().toISOString();

  return {
    id: payload?.id,
    title: payload?.title ?? payload?.subject ?? 'Announcement',
    message,
    type: payload?.type ?? 'info',
    target_audience: payload?.target_audience ?? payload?.audience ?? 'all',
    is_active: isActive,
    start_date: payload?.start_date ?? payload?.startDate ?? null,
    end_date: payload?.end_date ?? payload?.endDate ?? null,
    created_by: payload?.created_by,
    created_by_name: payload?.created_by_name,
    created_by_email: payload?.created_by_email,
    created_at: payload?.created_at ?? payload?.createdAt,
    updated_at: updatedAt,
    // Legacy fields kept for backward compatibility with UI components
    active: isActive,
    updatedAt,
  };
};

const silentErrorHeaders = {
  'X-Suppress-Error-Toast': '1',
} as const;
const fetchCandidates = [
  '/announcements?is_active=1',
  '/announcements',
  '/announcement',
  '/announcements/current',
  '/public/announcements',
  '/public/announcement',
];
const listCandidates = [
  '/announcements?all=1',
  '/announcements',
  '/announcement/all',
  '/announcement',
  '/admin/announcements',
  '/public/announcements',
  '/public/announcement',
];

const applyFilters = (
  announcements: Announcement[],
  filters?: {
    is_active?: boolean;
    type?: Announcement['type'];
    target_audience?: Announcement['target_audience'];
  }
) => {
  if (!filters) return announcements;
  return announcements.filter((item) => {
    if (filters.is_active !== undefined) {
      const active = item.is_active ?? item.active ?? false;
      if (filters.is_active !== active) return false;
    }
    if (filters.type && item.type !== filters.type) return false;
    if (filters.target_audience && item.target_audience !== filters.target_audience) return false;
    return true;
  });
};

const handleResponse = async (promise: Promise<any>) => {
  const response = await promise;
  try {
    return handleApiResponse<any>(response);
  } catch (error) {
    return response?.data?.data ?? response?.data ?? {};
  }
};

const toggleAnnouncement = async (id: number, shouldActivate: boolean): Promise<Announcement> => {
  if (!id) {
    throw new Error('Announcement ID is required');
  }

  try {
    const endpoint = shouldActivate ? `/announcements/${id}/activate` : `/announcements/${id}/deactivate`;
    const response = await apiClient.put(endpoint);
    const data = handleApiResponse<any>(response);
    return normalizeAnnouncement(data);
  } catch (error: any) {
    const action = shouldActivate ? 'activate' : 'deactivate';
    const message = error?.response?.data?.message || `Failed to ${action} announcement`;
    throw new Error(message);
  }
};

const buildRequestBody = (payload: SaveAnnouncementPayload) => {
  const body: Record<string, unknown> = {
    title: payload.title.trim(),
    message: payload.message.trim(),
    type: payload.type ?? 'info',
    target_audience: payload.target_audience ?? 'all',
    start_date: payload.start_date ?? null,
    end_date: payload.end_date ?? null,
  };

  if (payload.is_active !== undefined) {
    body.is_active = payload.is_active;
  }

  return body;
};

const requireTitleAndMessage = (payload: SaveAnnouncementPayload) => {
  if (!payload.title?.trim()) {
    throw new Error('Title is required');
  }
  if (!payload.message?.trim()) {
    throw new Error('Message is required');
  }
};

export const announcementService = {
  async fetchCurrent(): Promise<Announcement> {
    try {
      const publicAnnouncements = await this.fetchPublic();
      if (publicAnnouncements.length > 0) {
        return publicAnnouncements[0];
      }
    } catch (error) {
      console.warn('announcementService.fetchCurrent public feed fallback failed:', error);
    }

    try {
      const activeAnnouncements = await this.fetchAll({ is_active: true });
      if (activeAnnouncements.length > 0) {
        return activeAnnouncements.sort(
          (a, b) =>
            new Date(b.updated_at || b.updatedAt || '').getTime() -
            new Date(a.updated_at || a.updatedAt || '').getTime()
        )[0];
      }
    } catch (error) {
      // Fall back to legacy endpoints below
    }

    let lastError: unknown = null;
    for (const path of fetchCandidates) {
      try {
        const payload = await handleResponse(
          apiClient.get(path, {
            headers: silentErrorHeaders,
          })
        );

        if (Array.isArray(payload)) {
          if (payload.length === 0) {
            continue;
          }
          return normalizeAnnouncement(payload[0]);
        }

        return normalizeAnnouncement(payload);
      } catch (error) {
        lastError = error;
      }
    }

    console.warn('announcementService.fetchCurrent failed to reach backend:', lastError);
    return normalizeAnnouncement({ message: '', active: false });
  },

  async fetchAll(filters?: {
    is_active?: boolean;
    type?: Announcement['type'];
    target_audience?: Announcement['target_audience'];
  }): Promise<Announcement[]> {
    try {
      const params = new URLSearchParams();

      if (filters?.is_active !== undefined) {
        params.append('is_active', filters.is_active ? '1' : '0');
      }
      if (filters?.type) {
        params.append('type', filters.type);
      }
      if (filters?.target_audience) {
        params.append('target_audience', filters.target_audience);
      }

      const query = params.toString();
      const data = await handleResponse(
        apiClient.get(`/announcements${query ? `?${query}` : ''}`, {
          headers: silentErrorHeaders,
        })
      );

      const announcements = Array.isArray(data) ? data : data?.data ?? [];
      const normalized = announcements.map(normalizeAnnouncement);
      if (normalized.length > 0) {
        return normalized;
      }
    } catch (error: any) {
      if (error?.response?.status === 401) {
        throw error;
      }
      console.warn('announcementService.fetchAll primary endpoint failed:', error);
    }

    for (const path of listCandidates) {
      try {
        const payload = await handleResponse(
          apiClient.get(path, {
            headers: silentErrorHeaders,
          })
        );

        const rawList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : payload
          ? [payload]
          : [];

        if (rawList.length === 0) {
          continue;
        }

        const normalized = rawList.map(normalizeAnnouncement);
        const filtered = applyFilters(normalized, filters);
        if (filtered.length > 0) {
          return filtered;
        }
      } catch (fallbackError) {
        console.warn(`announcementService.fetchAll fallback failed for ${path}:`, fallbackError);
      }
    }

    return [];
  },

  async fetchVisible(): Promise<Announcement[]> {
    try {
      const data = await handleResponse(
        apiClient.get('/announcements', {
          headers: silentErrorHeaders,
        })
      );

      const announcements = Array.isArray(data) ? data : data?.data ?? [];
      const normalized = announcements.map(normalizeAnnouncement);
      return normalized.filter((item: Announcement) => item.is_active || item.active);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        throw error;
      }
      console.warn('announcementService.fetchVisible failed:', error);
      return [];
    }
  },

  async fetchPublic(): Promise<Announcement[]> {
    try {
      const url = new URL('https://www.ndosiautomation.co.za/EDENDALESPORTSPROJECTNPC/api/announcements/public');
      url.searchParams.set('_ts', Date.now().toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Public announcements request failed with status ${response.status}`);
      }

      const raw = await response.json().catch(() => ({}));
      const data = (raw?.data ?? raw) as unknown;
      const list = Array.isArray(data) ? data : [];
      return list
        .map(normalizeAnnouncement)
        .filter((a) => a.is_active || a.active)
        .sort(
          (a, b) => new Date(b.updated_at || b.updatedAt || '').getTime() - new Date(a.updated_at || a.updatedAt || '').getTime()
        );
    } catch (error) {
      console.warn('announcementService.fetchPublic failed:', error);
      return [];
    }
  },

  async fetchById(id: number): Promise<Announcement | null> {
    try {
      const payload = await handleResponse(
        apiClient.get(`/announcements/${id}`, {
          headers: silentErrorHeaders,
        })
      );
      return normalizeAnnouncement(payload);
    } catch (error) {
      console.warn('announcementService.fetchById failed:', error);
      return null;
    }
  },

  async fetchActive(): Promise<Announcement[]> {
    try {
      return await this.fetchAll({ is_active: true });
    } catch (error: any) {
      if (error?.response?.status === 401) {
        return [];
      }
      console.warn('announcementService.fetchActive fallback path triggered:', error);
      const current = await this.fetchCurrent();
      return current.is_active ? [current] : [];
    }
  },

  async fetchInactive(): Promise<Announcement[]> {
    return this.fetchAll({ is_active: false });
  },

  async fetchByType(type: Announcement['type']): Promise<Announcement[]> {
    return this.fetchAll({ type });
  },

  async fetchByAudience(target_audience: Announcement['target_audience']): Promise<Announcement[]> {
    return this.fetchAll({ target_audience });
  },

  async deactivateActiveAnnouncements(): Promise<void> {
    try {
      const active = await this.fetchActive();
      await Promise.all(
        active
          .filter((item): item is Announcement & { id: number } => Boolean(item.id))
          .map((item) => this.deactivate(item.id))
      );
    } catch (error) {
      console.warn('Failed to deactivate current active announcements:', error);
    }
  },

  async save(payload: SaveAnnouncementPayload): Promise<Announcement> {
    requireTitleAndMessage(payload);
    const body = buildRequestBody(payload);

    try {
      const response = payload.id
        ? await apiClient.put(`/announcements/${payload.id}`, body)
        : await apiClient.post('/announcements', body);

      const data = handleApiResponse<any>(response);
      let normalized = normalizeAnnouncement(data);

      if (normalized.id) {
        const desiredActive = payload.is_active ?? (payload.id ? undefined : true);

        if (desiredActive !== undefined) {
          if (desiredActive !== normalized.is_active) {
            normalized = await toggleAnnouncement(normalized.id, desiredActive);
          } else if (!payload.id && desiredActive && !normalized.is_active) {
            normalized = await toggleAnnouncement(normalized.id, true);
          }
        }
      }

      return normalized;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        throw new Error('Authentication required. Please log in as an administrator.');
      }
      if (status === 403) {
        throw new Error('You do not have permission to manage announcements.');
      }
      const message = error?.response?.data?.message || 'Failed to save announcement';
      const errors = error?.response?.data?.errors;
      let details = '';
      if (errors && typeof errors === 'object') {
        const parts: string[] = [];
        for (const value of Object.values(errors)) {
          if (Array.isArray(value)) {
            parts.push(value.join(' '));
          } else if (value) {
            parts.push(String(value));
          }
        }
        details = parts.join(' ');
      }
      throw new Error(details || message);
    }
  },

  async create(payload: SaveAnnouncementPayload): Promise<Announcement> {
    return this.save({ ...payload, id: undefined, is_active: payload.is_active ?? true });
  },

  async publish(payload: SaveAnnouncementPayload & { active?: boolean }): Promise<Announcement> {
    const desiredActive = payload.is_active ?? payload.active ?? true;
    return this.save({ ...payload, is_active: desiredActive });
  },

  async update(id: number, payload: SaveAnnouncementPayload): Promise<Announcement> {
    return this.save({ ...payload, id });
  },

  async delete(id: number): Promise<void> {
    if (!id) {
      throw new Error('Announcement ID is required');
    }

    try {
      await handleResponse(apiClient.delete(`/announcements/${id}`));
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to delete announcement';
      throw new Error(message);
    }
  },

  async activate(id: number): Promise<Announcement> {
    return toggleAnnouncement(id, true);
  },

  async deactivate(id: number): Promise<Announcement> {
    return toggleAnnouncement(id, false);
  },
};

export default announcementService;
