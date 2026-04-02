'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();

  const handleRestartTour = () => {
    // Clear the dismissal flag and force show tour
    localStorage.removeItem('avalanche-tour-dismissed');
    router.push('/?tour=true');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-slate-100">⚙️ Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Tour Section */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Onboarding</h2>
          <p className="text-sm text-slate-400 mb-4">
            Revisit the feature tour to learn about new functionality.
          </p>
          <button
            onClick={handleRestartTour}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition active:scale-[0.98] touch-manipulation"
          >
            🎯 Feature Tour
          </button>
        </div>

        {/* Data Section */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Data</h2>
          <p className="text-sm text-slate-400 mb-4">
            Manage your local data and preferences.
          </p>
          <button
            onClick={() => {
              if (confirm('Clear all local data? This cannot be undone.')) {
                localStorage.clear();
                sessionStorage.clear();
                alert('Local data cleared. Refresh the page to see changes.');
              }
            }}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 py-3 rounded-xl font-semibold transition active:scale-[0.98] touch-manipulation"
          >
            🗑️ Clear Local Data
          </button>
        </div>

        {/* About Section */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">About</h2>
          <div className="space-y-2 text-sm text-slate-400">
            <p><strong className="text-slate-300">Avalanche Safety App</strong></p>
            <p>Version 1.0.0</p>
            <p>Stay safe in the backcountry.</p>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex safe-area-inset-bottom">
        <Link href="/check-in" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">📍</span>
          <span className="text-xs font-medium">Check In</span>
        </Link>
        <Link href="/" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">🗺️</span>
          <span className="text-xs font-medium">Map</span>
        </Link>
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">📊</span>
          <span className="text-xs font-medium">Data</span>
        </Link>
        <Link href="/settings" className="flex-1 flex flex-col items-center py-3 text-blue-400">
          <span className="text-xl mb-0.5">⚙️</span>
          <span className="text-xs font-medium">Settings</span>
        </Link>
      </nav>

      <style jsx global>{`
        .safe-area-inset-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
      `}</style>
    </div>
  );
}
