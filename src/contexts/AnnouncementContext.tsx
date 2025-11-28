import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { announcementService } from '../services/announcementService';
import type { Announcement } from '../types';
import { UserRole } from '../types';
import { useAuth } from './AuthContext';

export interface SiteAnnouncement {
  id?: number;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'urgent' | 'maintenance';
  target_audience?: 'all' | 'customers' | 'staff';
  active: boolean;
  is_active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  created_by_name?: string;
  updatedAt?: string;
}

interface AnnouncementContextValue {
  announcement: SiteAnnouncement;
  updateAnnouncement: (next: SiteAnnouncement | ((prev: SiteAnnouncement) => SiteAnnouncement)) => Promise<SiteAnnouncement>;
  clearAnnouncement: () => Promise<SiteAnnouncement>;
  refreshAnnouncement: () => Promise<SiteAnnouncement | null>;
}

const STORAGE_KEY = 'site_announcement';
const defaultAnnouncement: SiteAnnouncement = { message: '', active: false };

const AnnouncementContext = createContext<AnnouncementContextValue | undefined>(undefined);

const normalizeAnnouncement = (payload?: Partial<SiteAnnouncement & Announcement>): SiteAnnouncement => {
  if (!payload) {
    return { ...defaultAnnouncement, updatedAt: new Date().toISOString() };
  }
  const message = (payload.message ?? '').toString();
  const active = Boolean(
    (payload.active ?? payload.is_active ?? false) && message.trim().length > 0
  );
  const updatedAt = payload.updatedAt || (payload as Announcement).updated_at || new Date().toISOString();
  
  return {
    id: payload.id,
    title: payload.title,
    message,
    type: payload.type ?? 'info',
    target_audience: payload.target_audience ?? 'all',
    active,
    is_active: active,
    start_date: payload.start_date,
    end_date: payload.end_date,
    created_by_name: payload.created_by_name,
    updatedAt,
  };
};

export const AnnouncementProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userRole = user?.role as UserRole | undefined;
  const [announcement, setAnnouncement] = useState<SiteAnnouncement>(() => {
    if (typeof window === 'undefined') return defaultAnnouncement;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            message: parsed.message || '',
            active: Boolean(parsed.active),
            updatedAt: parsed.updatedAt,
          };
        }
      }
    } catch (err) {
      console.warn('Failed to parse announcement cache', err);
    }
    return defaultAnnouncement;
  });

  const announcementRef = useRef<SiteAnnouncement>(announcement);
  useEffect(() => {
    announcementRef.current = announcement;
  }, [announcement]);

  const persist = useCallback((next: SiteAnnouncement) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('Failed to persist announcement', err);
    }
  }, []);

  const applyAnnouncement = useCallback(
    (next: SiteAnnouncement): SiteAnnouncement => {
      const normalized = normalizeAnnouncement(next);
      announcementRef.current = normalized;
      setAnnouncement(normalized);
      persist(normalized);
      return normalized;
    },
    [persist]
  );

  const refreshAnnouncement = useCallback(async () => {
    let token = localStorage.getItem('accessToken');

    const applyFromRemote = (remote?: Announcement | null): SiteAnnouncement => {
      if (!remote) {
        return announcementRef.current;
      }

      const normalized = normalizeAnnouncement(remote);
      if (!normalized.active || !normalized.message.trim()) {
        return applyAnnouncement(defaultAnnouncement);
      }

      const current = announcementRef.current;
      if (
        normalized.id !== current.id ||
        normalized.message !== current.message ||
        normalized.active !== current.active ||
        normalized.updatedAt !== current.updatedAt
      ) {
        return applyAnnouncement(normalized);
      }
      return normalized;
    };

    let latest: Announcement | null = null;

    if (token) {
      try {
        const requiresAdminScope = userRole === UserRole.Admin || userRole === UserRole.Staff;
        const activeAnnouncements = requiresAdminScope
          ? await announcementService.fetchActive()
          : await announcementService.fetchVisible();
        if (activeAnnouncements.length > 0) {
          latest = activeAnnouncements.sort(
            (a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()
          )[0];
        }
      } catch (error: any) {
        if (error?.response?.status === 401) {
          console.log('Announcement token rejected – clearing session and falling back to public feed');
          localStorage.removeItem('accessToken');
          token = null;
        } else {
          console.warn('Failed to fetch authenticated announcements:', error);
        }
      }
    }

    if (!latest) {
      try {
        latest = await announcementService.fetchCurrent();
      } catch (error) {
        console.warn('Unable to fetch public announcement feed:', error);
        latest = null;
      }
    }

    if (latest) {
      return applyFromRemote(latest);
    }

    return applyFromRemote(null);
  }, [applyAnnouncement, userRole]);

  useEffect(() => {
    refreshAnnouncement();
    const interval = window.setInterval(() => {
      refreshAnnouncement();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [refreshAnnouncement]);

  const updateAnnouncement = useCallback(
    async (next: SiteAnnouncement | ((prev: SiteAnnouncement) => SiteAnnouncement)) => {
      const resolved =
        typeof next === 'function' ? (next as (p: SiteAnnouncement) => SiteAnnouncement)(announcementRef.current) : next;
      const normalized = normalizeAnnouncement(resolved);
      
      try {
        const publishPayload = {
          title: normalized.title || 'Site Announcement',
          message: normalized.message,
          type: normalized.type,
          target_audience: normalized.target_audience,
          start_date: normalized.start_date,
          end_date: normalized.end_date,
          is_active: normalized.active,
        };

        const remote = await announcementService.publish(
          normalized.id ? { ...publishPayload, id: normalized.id } : publishPayload
        );
        
        return applyAnnouncement(
          normalizeAnnouncement({
            id: remote.id,
            title: remote.title,
            message: remote.message,
            type: remote.type,
            target_audience: remote.target_audience,
            active: remote.is_active,
            is_active: remote.is_active,
            start_date: remote.start_date,
            end_date: remote.end_date,
            created_by_name: remote.created_by_name,
            updatedAt: remote.updated_at || remote.updatedAt,
          })
        );
      } catch (error) {
        console.error('Failed to update announcement in database:', error);
        throw error;
      }
    },
    [applyAnnouncement]
  );

  const clearAnnouncement = useCallback(async () => {
    const current = announcementRef.current;
    if (current.id) {
      try {
        console.log('Deactivating current announcement in database');
        await announcementService.deactivate(current.id);
        return applyAnnouncement({ ...defaultAnnouncement, id: current.id });
      } catch (error) {
        console.error('Failed to deactivate announcement:', error);
        throw error;
      }
    } else {
      return applyAnnouncement(defaultAnnouncement);
    }
  }, [applyAnnouncement]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as SiteAnnouncement;
          applyAnnouncement(parsed);
        } catch (err) {
          console.warn('Failed to sync announcement from storage', err);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [applyAnnouncement]);

  const value = useMemo(
    () => ({ announcement, updateAnnouncement, clearAnnouncement, refreshAnnouncement }),
    [announcement, updateAnnouncement, clearAnnouncement, refreshAnnouncement]
  );

  return <AnnouncementContext.Provider value={value}>{children}</AnnouncementContext.Provider>;
};

export const useAnnouncement = () => {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) {
    throw new Error('useAnnouncement must be used within AnnouncementProvider');
  }
  return ctx;
};
