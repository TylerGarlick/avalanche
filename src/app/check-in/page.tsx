'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ZONE_COORDINATES } from '@/lib/zone-coordinates';

const ZONES = ZONE_COORDINATES.map(({ zoneId, zone, center }) => ({
  id: zoneId,
  name: zone,
  description: center,
}));

function CheckInContent() {
  const searchParams = useSearchParams();
  const preSelected = searchParams.get('zone');
  const [selectedZone, setSelectedZone] = useState<string | null>(preSelected);
  const [partnerToken, setPartnerToken] = useState('');
  const [checkedIn, setCheckedIn] = useState<{ id: string; expiresAt: string; zoneName: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckIn() {
    if (!selectedZone) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: selectedZone,
          partnerToken: partnerToken || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Check-in failed');
      }

      const data = await res.json();
      const zoneName = ZONES.find(z => z.id === selectedZone)?.name || selectedZone;
      setCheckedIn({ id: data.id, expiresAt: data.expiresAt, zoneName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!checkedIn || !selectedZone) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/check-in?id=${checkedIn.id}&zoneId=${selectedZone}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Check-out failed');
      setCheckedIn(null);
      setSelectedZone(null);
      setPartnerToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-out failed');
    } finally {
      setLoading(false);
    }
  }

  if (checkedIn) {
    const expiresAt = new Date(checkedIn.expiresAt);
    return (
      <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100">
        <div className="flex-1 flex flex-col items-center justify-center p-6 pb-24">
          <div className="text-7xl mb-6">✅</div>
          <h2 className="text-2xl font-bold text-emerald-400 mb-2">Checked In</h2>
          <p className="text-slate-300 text-center mb-2">
            You&apos;re in <strong>{checkedIn.zoneName}</strong>
          </p>
          <p className="text-slate-500 text-sm mb-8">
            Auto checkout at {expiresAt.toLocaleTimeString()}
          </p>

          <div className="w-full max-w-sm bg-slate-800 rounded-xl p-4 mb-8">
            <p className="text-xs text-slate-400 mb-1">Your check-in ID</p>
            <p className="font-mono text-sm text-slate-300 break-all">{checkedIn.id}</p>
          </div>

          <button
            onClick={handleCheckOut}
            disabled={loading}
            className="w-full max-w-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-100 py-4 rounded-xl font-semibold text-lg transition touch-manipulation"
          >
            {loading ? 'Checking out...' : 'Check Out Early'}
          </button>
        </div>

        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex safe-area-inset-bottom">
          <a href="/check-in" className="flex-1 flex flex-col items-center py-3 text-blue-400">
            <span className="text-xl mb-0.5">📍</span>
            <span className="text-xs font-medium">Check In</span>
          </a>
          <a href="/" className="flex-1 flex flex-col items-center py-3 text-slate-400">
            <span className="text-xl mb-0.5">🗺️</span>
            <span className="text-xs font-medium">Map</span>
          </a>
          <a href="/patrol" className="flex-1 flex flex-col items-center py-3 text-slate-400">
            <span className="text-xl mb-0.5">🚁</span>
            <span className="text-xs font-medium">Patrol</span>
          </a>
        </nav>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-slate-100">🏔️ Check In</h1>
        <p className="text-sm text-slate-400">Select your zone to check in</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 mb-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* How it works */}
        <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700">
          <p className="text-sm text-slate-300">
            <strong>How it works:</strong> Check in when entering a zone. Patrol sees aggregate counts only — your identity stays private. Auto-checkout after 6 hours.
          </p>
        </div>

        {/* Zone selector */}
        <h2 className="text-base font-semibold text-slate-200 mb-3">Select Zone</h2>
        <div className="space-y-2 mb-6">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              onClick={() => setSelectedZone(zone.id)}
              className={`w-full p-4 rounded-xl text-left transition active:scale-[0.98] touch-manipulation ${
                selectedZone === zone.id
                  ? 'bg-blue-600 border-2 border-blue-400'
                  : 'bg-slate-800 border-2 border-slate-700 active:bg-slate-700'
              }`}
            >
              <p className="font-semibold text-slate-100">{zone.name}</p>
              <p className="text-sm text-slate-400">{zone.description}</p>
            </button>
          ))}
        </div>

        {/* Partner code */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            🔗 Partner Check-In (optional)
          </label>
          <input
            type="text"
            value={partnerToken}
            onChange={(e) => setPartnerToken(e.target.value)}
            placeholder="Share a code with your partner"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-base"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            If only one of you checks out, the other gets alerted.
          </p>
        </div>

        {/* Check-in button */}
        <button
          onClick={handleCheckIn}
          disabled={!selectedZone || loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition active:scale-[0.98] touch-manipulation"
        >
          {loading ? 'Checking in...' : 'Check In'}
        </button>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex safe-area-inset-bottom">
        <a href="/check-in" className="flex-1 flex flex-col items-center py-3 text-blue-400">
          <span className="text-xl mb-0.5">📍</span>
          <span className="text-xs font-medium">Check In</span>
        </a>
        <a href="/" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">🗺️</span>
          <span className="text-xs font-medium">Map</span>
        </a>
        <a href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">📊</span>
          <span className="text-xs font-medium">Data</span>
        </a>
        <a href="/patrol" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">🚁</span>
          <span className="text-xs font-medium">Patrol</span>
        </a>
      </nav>

      <style jsx global>{`
        .safe-area-inset-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
      `}</style>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <CheckInContent />
    </Suspense>
  );
}
