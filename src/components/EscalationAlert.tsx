'use client';

import { useState } from 'react';
import { CheckIn } from '@/hooks/useEscalationCheck';

export interface EscalationAlertProps {
  expiredCheckIn: CheckIn;
  onResolved: () => void;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
}

export default function EscalationAlert({
  expiredCheckIn,
  onResolved,
}: EscalationAlertProps) {
  const [showContacts, setShowContacts] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [resolving, setResolving] = useState(false);

  async function handleImOkay() {
    setResolving(true);
    try {
      await fetch('/api/check-in/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expiredCheckIn.id }),
      });
      localStorage.setItem(
        'escalation-dismissed',
        JSON.stringify({ checkInId: expiredCheckIn.id, timestamp: Date.now() })
      );
      onResolved();
    } catch (err) {
      console.error('Checkout failed:', err);
      setResolving(false);
    }
  }

  async function handleCallContacts() {
    setLoadingContacts(true);
    try {
      const res = await fetch('/api/emergency-contacts');
      if (res.ok) {
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : data.contacts ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoadingContacts(false);
    }
    setShowContacts(true);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-slate-900 border-2 border-red-600 rounded-3xl p-8 text-center shadow-2xl shadow-red-900/50">
        {!showContacts ? (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-400 mb-2">
              Your Check-In Has Expired
            </h1>
            <p className="text-slate-400 mb-8">
              You haven&apos;t checked out and your safety window has passed.
              Please confirm you&apos;re okay or call your emergency contacts.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleImOkay}
                disabled={resolving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                {resolving ? 'Checking out...' : "I'm Okay"}
              </button>
              <button
                onClick={handleCallContacts}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl transition-colors"
              >
                Call Emergency Contacts
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">📞</div>
            <h2 className="text-xl font-bold text-slate-100 mb-4">
              Emergency Contacts
            </h2>

            {loadingContacts ? (
              <p className="text-slate-400 py-8">Loading contacts...</p>
            ) : contacts.length === 0 ? (
              <div className="py-8">
                <p className="text-slate-400 mb-4">No emergency contacts found.</p>
                <p className="text-slate-500 text-sm">
                  Add contacts in Settings → Emergency Contacts
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {contacts.map((contact) => (
                  <a
                    key={contact.id}
                    href={`tel:${contact.phone}`}
                    className="block bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-red-500 transition-colors"
                  >
                    <p className="font-semibold text-slate-100">{contact.name}</p>
                    <p className="text-red-400 text-sm">{contact.phone}</p>
                    {contact.relationship && (
                      <p className="text-slate-500 text-xs">{contact.relationship}</p>
                    )}
                  </a>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <a
                href="tel:911"
                className="block w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl transition-colors text-center"
              >
                Call 911
              </a>
              <button
                onClick={() => setShowContacts(false)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-6 rounded-xl transition-colors"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
