import { useEffect, useState } from 'react';
import announcementService from '../../services/announcementService';
import type { Announcement } from '../../types';
import LoadingSpinner from './LoadingSpinner';
import { Card } from './Card';

const PublicAnnouncements = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await announcementService.fetchPublic();
        if (mounted) setItems(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load announcements');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="flex justify-center py-6"><LoadingSpinner /></div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;
  if (!items.length) return null;

  return (
    <div className="space-y-3">
      {items.map((a) => (
        <Card key={a.id ?? a.updated_at} className="border border-blue-200 bg-blue-50">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">{a.title}</h3>
              <p className="text-sm text-blue-800 mt-1 whitespace-pre-wrap">{a.message}</p>
            </div>
            {(a.updated_at || a.created_at) && (
              <span className="text-xs text-blue-700">
                {new Date(a.updated_at || a.created_at || '').toLocaleString()}
              </span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default PublicAnnouncements;
