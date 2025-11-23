import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { useState } from 'react';

const Layout = () => {
  // Check sessionStorage to show POPIA notice only once per session
  const [showPopia, setShowPopia] = useState(() => {
    if (typeof window !== 'undefined') {
      const acknowledged = sessionStorage.getItem('popia_acknowledged');
      return !acknowledged;
    }
    return true;
  });

  const handleAcknowledge = () => {
    sessionStorage.setItem('popia_acknowledged', 'true');
    setShowPopia(false);
  };
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {showPopia && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-xs z-50">
          <p className="text-gray-700 mb-2 font-semibold">Privacy Notice</p>
          <p className="text-gray-600 mb-3">We process your personal data (contact & booking details) only to manage reservations in compliance with POPIA. By continuing you consent to this processing.</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleAcknowledge}
              className="px-3 py-1 rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;