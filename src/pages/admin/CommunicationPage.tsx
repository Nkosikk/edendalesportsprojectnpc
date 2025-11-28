import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Power, PowerOff, RefreshCw, Shield, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { useAnnouncement } from '../../contexts/AnnouncementContext';
import type { Announcement } from '../../types';
import { announcementService } from '../../services/announcementService';
import toast from 'react-hot-toast';

const CommunicationPage = () => {
  const { announcement, updateAnnouncement, clearAnnouncement } = useAnnouncement();
  const [title, setTitle] = useState(announcement.title || '');
  const [message, setMessage] = useState(announcement.message);
  const [type, setType] = useState<'info' | 'warning' | 'urgent' | 'maintenance'>(announcement.type || 'info');
  const [targetAudience, setTargetAudience] = useState<'all' | 'customers' | 'staff'>(announcement.target_audience || 'all');
  const [existingAnnouncements, setExistingAnnouncements] = useState<Announcement[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState<number | 'new'>('new');
  const [loadingExisting, setLoadingExisting] = useState(false);
  const badgeVariantByType = {
    info: 'info',
    warning: 'warning',
    urgent: 'danger',
    maintenance: 'default',
  } as const;

  useEffect(() => {
    setTitle(announcement.title || '');
    setMessage(announcement.message);
    setType(announcement.type || 'info');
    setTargetAudience(announcement.target_audience || 'all');
    setSelectedExistingId(announcement.id ?? 'new');
  }, [announcement]);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoadingExisting(true);
      const [active, inactive] = await Promise.all([
        announcementService.fetchActive(),
        announcementService.fetchInactive(),
      ]);
      const combined = [...active, ...inactive]
        .filter((item): item is Announcement & { id: number } => Boolean(item.id))
        .sort(
          (a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()
        );
      setExistingAnnouncements(combined);
    } catch (error) {
      console.warn('Failed to load announcement presets', error);
    } finally {
      setLoadingExisting(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleSelectExisting = (value: string) => {
    if (value === 'new') {
      setSelectedExistingId('new');
      setTitle('');
      setMessage('');
      setType('info');
      setTargetAudience('all');
      return;
    }
    const id = Number(value);
    const found = existingAnnouncements.find((item) => item.id === id);
    if (!found) {
      return;
    }

    setSelectedExistingId(id);
    setTitle(found.title || '');
    setMessage(found.message || '');
    setType(found.type || 'info');
    setTargetAudience(found.target_audience || 'all');
  };

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please add both a title and message before enabling the banner.');
      return;
    }

    try {
      await announcementService.deactivateActiveAnnouncements();
      const result = await updateAnnouncement({
        title: title.trim(),
        message: message.trim(),
        type,
        target_audience: targetAudience,
        active: true,
      });
      toast.success('Announcement banner published and activated for all users');
      await loadAnnouncements();
      if (result.id) {
        setSelectedExistingId(result.id);
      }
    } catch (error: any) {
      console.error('Failed to publish announcement:', error);
      const message = error?.message || 'Failed to publish announcement';
      toast.error(message);
    }
  };

  const handleDisable = async () => {
    try {
      await clearAnnouncement();
      toast.success('Announcement banner hidden from all users');
    } catch (error: any) {
      console.error('Failed to hide announcement:', error);
      const message = error?.message || 'Failed to hide announcement';
      toast.error(message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-start gap-3">
          <span className="p-3 rounded-2xl bg-primary-100 text-primary-700">
            <Megaphone className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
            <p className="text-sm text-gray-600">
              Craft, preview, and broadcast announcements to every visitor.
            </p>
          </div>
        </div>
        <Badge variant={announcement.active ? 'success' : 'default'} className="uppercase tracking-wide">
          {announcement.active ? 'Live banner' : 'No banner active'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),320px]">
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Announcement editor</CardTitle>
            <p className="text-sm text-gray-500">
              Reuse a saved announcement or compose a fresh update. Publishing automatically replaces the current banner.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="existing" className="text-sm font-medium text-gray-800">
                Saved announcements
              </label>
              <div className="relative">
                <select
                  id="existing"
                  value={selectedExistingId === 'new' ? 'new' : String(selectedExistingId)}
                  onChange={(event) => handleSelectExisting(event.target.value)}
                  disabled={loadingExisting}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="new">Compose a new announcement</option>
                  {existingAnnouncements.map((item) => (
                    <option key={item.id} value={item.id ?? ''}>
                      {item.title || `Announcement #${item.id}`} {item.is_active ? '• active' : ''}
                    </option>
                  ))}
                </select>
                <RefreshCw
                  className={`pointer-events-none absolute right-3 top-2.5 h-4 w-4 ${loadingExisting ? 'animate-spin text-primary-500' : 'text-gray-400'}`}
                />
              </div>
              <p className="text-xs text-gray-500">
                Selecting an existing announcement pauses any live banner so you can safely revise before publishing.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium text-gray-800">
                Title
              </label>
              <input
                id="title"
                type="text"
                maxLength={255}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="e.g. Holiday hours update"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="type" className="text-sm font-medium text-gray-800">
                  Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as 'info' | 'warning' | 'urgent' | 'maintenance')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="urgent">Urgent</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="audience" className="text-sm font-medium text-gray-800">
                  Target audience
                </label>
                <select
                  id="audience"
                  value={targetAudience}
                  onChange={(event) => setTargetAudience(event.target.value as 'all' | 'customers' | 'staff')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  <option value="all">Everyone</option>
                  <option value="customers">Customers</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="announcement" className="text-sm font-medium text-gray-800">
                Message
              </label>
              <textarea
                id="announcement"
                rows={5}
                maxLength={500}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Share key dates, service changes, or urgent notices."
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Keep it concise and action-oriented.</span>
                <span>{message.length}/500 characters</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handlePublish} icon={Power} className="sm:flex-1">
                Publish banner
              </Button>
              <Button
                variant="outline"
                onClick={handleDisable}
                disabled={!announcement.active}
                icon={PowerOff}
                className="sm:flex-1"
              >
                Hide banner
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="relative overflow-hidden border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-blue-50 shadow-sm">
            <div className="absolute inset-y-0 right-0 w-28 bg-primary-100/40 blur-3xl" aria-hidden />
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-primary-900">
                <Shield className="h-5 w-5" /> Current banner
              </CardTitle>
              <p className="text-xs uppercase tracking-wide text-primary-600">
                {announcement.updatedAt ? `Updated ${new Date(announcement.updatedAt).toLocaleString()}` : 'No updates yet'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {announcement.active ? (
                <>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-gray-900">{announcement.title || 'Untitled announcement'}</h3>
                    <Badge
                      variant={badgeVariantByType[(announcement.type as keyof typeof badgeVariantByType) ?? 'info']}
                      size="sm"
                      className="uppercase tracking-wide"
                    >
                      {announcement.type || 'info'}
                    </Badge>
                  </div>
                  <p className="rounded-lg border border-primary-100 bg-white/70 p-3 text-sm text-gray-700">
                    {announcement.message}
                  </p>
                  <div className="flex flex-col gap-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary-500" />
                      <span>Audience: <strong className="uppercase">{announcement.target_audience || 'all'}</strong></span>
                    </div>
                    {announcement.created_by_name && (
                      <span>Published by {announcement.created_by_name}</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-primary-200 bg-white/80 p-4 text-sm text-gray-600">
                  No live announcement. Publish one to keep users informed.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Tips for effective updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>• Lead with the key action or deadline.</p>
              <p>• Keep the message under three short sentences.</p>
              <p>• Use the banner sparingly so urgent notices stand out.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CommunicationPage;
