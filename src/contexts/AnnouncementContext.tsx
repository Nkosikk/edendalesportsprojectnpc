import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface SiteAnnouncement {
  message: string;
  active: boolean;
  updatedAt?: string;
}

interface AnnouncementContextValue {
  announcement: SiteAnnouncement;
  updateAnnouncement: (next: SiteAnnouncement | ((prev: SiteAnnouncement) => SiteAnnouncement)) => void;
  clearAnnouncement: () => void;
}

const STORAGE_KEY = 'site_announcement';
const defaultAnnouncement: SiteAnnouncement = { message: '', active: false };

const AnnouncementContext = createContext<AnnouncementContextValue | undefined>(undefined);

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

  const persist = useCallback((next: SiteAnnouncement) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('Failed to persist announcement', err);
    }
  }, []);

  const updateAnnouncement = useCallback(
    (next: SiteAnnouncement | ((prev: SiteAnnouncement) => SiteAnnouncement)) => {
      setAnnouncement((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: SiteAnnouncement) => SiteAnnouncement)(prev) : next;
        const normalized = {
          message: resolved.message || '',
          active: Boolean(resolved.active && resolved.message?.trim()),
          updatedAt: new Date().toISOString(),
        } satisfies SiteAnnouncement;
        persist(normalized);
        return normalized;
      });
    },
    [persist]
  );

  const clearAnnouncement = useCallback(() => {
    updateAnnouncement(defaultAnnouncement);
  }, [updateAnnouncement]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as SiteAnnouncement;
          setAnnouncement({
            message: parsed.message || '',
            active: Boolean(parsed.active && parsed.message?.trim()),
            updatedAt: parsed.updatedAt,
          });
        } catch (err) {
          console.warn('Failed to sync announcement from storage', err);
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo(() => ({ announcement, updateAnnouncement, clearAnnouncement }), [announcement, updateAnnouncement, clearAnnouncement]);

  return <AnnouncementContext.Provider value={value}>{children}</AnnouncementContext.Provider>;
};

export const useAnnouncement = () => {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) {
    throw new Error('useAnnouncement must be used within AnnouncementProvider');
  }
  return ctx;
};
