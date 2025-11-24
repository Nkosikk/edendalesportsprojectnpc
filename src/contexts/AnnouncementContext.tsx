import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { announcementService } from '../services/announcementService';
import type { Announcement } from '../types';

export interface SiteAnnouncement {
  message: string;
  active: boolean;
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
  const active = Boolean((payload.active ?? false) && message.trim().length > 0);
  const updatedAt = payload.updatedAt || (payload as Announcement).updated_at || new Date().toISOString();
  return { message, active, updatedAt };
};

export const AnnouncementProvider = ({ children }: { children: ReactNode }) => {
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
    try {
      const remote = await announcementService.fetchCurrent();
      const normalized = normalizeAnnouncement({
        message: remote.message,
        active: remote.active,
        updatedAt: remote.updated_at || remote.updatedAt,
      });
      const current = announcementRef.current;
      if (
        normalized.message !== current.message ||
        normalized.active !== current.active ||
        normalized.updatedAt !== current.updatedAt
      ) {
        return applyAnnouncement(normalized);
      }
      return normalized;
    } catch (error) {
      console.warn('Unable to fetch announcement from backend', error);
      return null;
    }
  }, [applyAnnouncement]);

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
        const remote = await announcementService.publish({
          message: normalized.message,
          active: normalized.active,
        });
        return applyAnnouncement(
          normalizeAnnouncement({
            message: remote.message,
            active: remote.active,
            updatedAt: remote.updated_at || remote.updatedAt,
          })
        );
      } catch (error) {
        console.error('Failed to publish announcement, falling back to local state.', error);
        return applyAnnouncement(normalized);
      }
    },
    [applyAnnouncement]
  );

  const clearAnnouncement = useCallback(async () => {
    return updateAnnouncement(defaultAnnouncement);
  }, [updateAnnouncement]);

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
