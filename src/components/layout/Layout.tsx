import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { useAnnouncement } from '../../contexts/AnnouncementContext';

const Layout = () => {
  // Check localStorage to show POPIA notice only once (persists across sessions)
  const [showPopia, setShowPopia] = useState(() => {
    if (typeof window !== 'undefined') {
      const acknowledged = localStorage.getItem('popia_acknowledged');
      return !acknowledged;
    }
    return true;
  });

  const handleAcknowledge = () => {
    localStorage.setItem('popia_acknowledged', 'true');
    setShowPopia(false);
  };
  const { announcement } = useAnnouncement();
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    setAnnouncementDismissed(false);
  }, [announcement.active, announcement.message, announcement.updatedAt]);

  const showAnnouncementModal = useMemo(() => {
    if (!announcement.active || !announcement.message?.trim()) return false;
    return !announcementDismissed;
  }, [announcement, announcementDismissed]);

  const acknowledgeAnnouncement = () => {
    setAnnouncementDismissed(true);
  };
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {showPopia && (
        <div
          className="fixed inset-x-4 bottom-4 sm:bottom-6 sm:right-6 sm:left-auto sm:w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 sm:p-5 text-xs sm:text-sm z-50"
          role="alertdialog"
          aria-live="polite"
        >
          <p className="text-gray-800 mb-2 font-semibold text-sm">Privacy Notice</p>
          <p className="text-gray-600 mb-3 leading-relaxed">
            We process your personal data (contact & booking details) only to manage reservations in compliance with POPIA. By continuing you consent to this processing.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={handleAcknowledge}
              className="px-3 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 text-sm"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-40 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-primary-100">
            <div className="px-8 py-6 border-b border-primary-100 bg-gradient-to-r from-primary-50 to-blue-50 rounded-t-3xl flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl">!</div>
              <div>
                <p className="text-xs font-semibold uppercase text-primary-700 tracking-[0.3em]">Service notice</p>
                <p className="text-2xl font-bold text-gray-900">Important announcement</p>
              </div>
            </div>
            <div className="px-8 py-8 text-gray-800 text-xl leading-relaxed">
              {announcement.message}
            </div>
            <div className="px-8 py-6 bg-gray-50 rounded-b-3xl flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={acknowledgeAnnouncement}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary-600 text-white text-lg font-semibold shadow-lg hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
              >
                Continue to site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;