'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export default function EscalationAlert({
  expiredCheckIn,
  onResolved,
}: {
  expiredCheckIn: { id: string; zoneName: string; expiresAt: string };
  onResolved: () => void;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/emergency-contacts')
      .then((r) => r.json())
      .then(setContacts)
      .catch(() => setContacts([]));
  }, []);

  async function handleImOkay() {
    setLoading(true);
    try {
      await fetch(`/api/check-in?id=${expiredCheckIn.id}&zoneId=unknown`, {
        method: 'DELETE',
      });
      onResolved();
    } catch {
      setLoading(false);
    }
  }

  function handleCallContact(phone: string) {
    window.location.href = `tel:${phone}`;
  }

  if (showContacts) {
    return (
      <div className="fixed inset-0 bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 z-50">
        <div className="text-6xl mb-6">🆘</div>
        <h2 className="text-2xl font-bold text-red-400 mb-2">Emergency Contacts</h2>
        <p className="text-slate-300 text-center mb-8">
          Tap a contact to call them
        </p>

        {contacts.length === 0 ? (
          <div className="text-center">
            <p className="text-slate-400 mb-6">No emergency contacts set up.</p>
            <button
              onClick={() => router.push('/settings/emergency-contacts')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold"
            >
              Add Contacts
            </button>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-3">
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => handleCallContact(c.phone)}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-xl flex items-center justify-between"
              >
                <div className="text-left">
                  <p className="font-semibold text-slate-100">{c.name}</p>
                  <p className="text-sm text-slate-400">{c.phone}</p>
                </div>
                <span className="text-2xl">📞</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowContacts(false)}
          className="mt-8 text-slate-400 hover:text-slate-200 text-sm"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 z-50">
      <div className="text-7xl mb-6">⚠️</div>
      <h2 className="text-2xl font-bold text-red-400 mb-2">Haven&apos;t Heard From You</h2>
      <p className="text-slate-300 text-center mb-2">
        You checked in to <strong>{expiredCheckIn.zoneName}</strong> but haven&apos;t checked out.
      </p>
      <p className="text-slate-500 text-sm text-center mb-8">
        Your check-in expired at{' '}
        {new Date(expiredCheckIn.expiresAt).toLocaleTimeString()}
      </p>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={handleImOkay}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-xl font-bold text-lg"
        >
          {loading ? 'Processing...' : "I'm Okay — Check Me Out"}
        </button>

        <button
          onClick={() => setShowContacts(true)}
          className="w-full bg-slate-800 hover:bg-slate-700 border border-red-700 text-red-300 py-4 rounded-xl font-semibold text-lg"
        >
          Call Emergency Contacts
        </button>
      </div>

      <p className="text-slate-600 text-xs text-center mt-6">
        If you&apos;re really in trouble, call 911 directly.
      </p>
    </div>
  );
}
