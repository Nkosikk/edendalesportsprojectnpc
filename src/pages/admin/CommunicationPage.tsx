import { useEffect, useState } from 'react';
import { Megaphone, Power, PowerOff } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { useAnnouncement } from '../../contexts/AnnouncementContext';
import toast from 'react-hot-toast';

const CommunicationPage = () => {
  const { announcement, updateAnnouncement, clearAnnouncement } = useAnnouncement();
  const [message, setMessage] = useState(announcement.message);

  useEffect(() => {
    setMessage(announcement.message);
  }, [announcement.message]);

  const handlePublish = () => {
    if (!message.trim()) {
      toast.error('Add a short announcement before enabling the banner.');
      return;
    }
    updateAnnouncement({
      message: message.trim(),
      active: true,
    });
    toast.success('Announcement banner enabled');
  };

  const handleDisable = () => {
    clearAnnouncement();
    toast('Announcement banner hidden');
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-0">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-primary-50 text-primary-600">
          <Megaphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
          <p className="text-sm text-gray-600">Publish a site-wide banner for important updates.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Announcement banner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-primary-200 bg-primary-50/40 p-4 text-sm text-primary-900">
            <p className="font-semibold mb-1">Current status</p>
            {announcement.active ? (
              <p>
                Banner is <span className="font-semibold text-green-700">live</span> with message:
                <span className="ml-1 italic">“{announcement.message}”</span>
              </p>
            ) : (
              <p>No banner is visible to customers.</p>
            )}
          </div>

          <div>
            <label htmlFor="announcement" className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              id="announcement"
              rows={4}
              maxLength={240}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              placeholder="e.g. Summer league registrations close on 8 Dec. Pay your invoices to secure your slot."
            />
            <div className="mt-1 text-xs text-gray-500">{message.length}/240 characters</div>
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
    </div>
  );
};

export default CommunicationPage;
