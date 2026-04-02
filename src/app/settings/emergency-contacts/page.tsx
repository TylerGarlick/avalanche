'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    try {
      const res = await fetch('/api/emergency-contacts');
      if (res.ok) {
        const data = await res.json();
        setContacts(Array.isArray(data) ? data : []);
      }
    } catch {
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/emergency-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, relationship }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add contact');
      }

      setName('');
      setPhone('');
      setRelationship('');
      setSuccess('Contact added successfully');
      fetchContacts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/emergency-contacts?id=${id}`, { method: 'DELETE' });
      setContacts(contacts.filter((c) => c.id !== id));
      setSuccess('Contact removed');
    } catch {
      setError('Failed to delete contact');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings" className="text-slate-400 hover:text-slate-200">
            ←
          </Link>
          <span className="text-2xl">🆘</span>
          <h1 className="text-2xl font-bold">Emergency Contacts</h1>
        </div>

        <p className="text-slate-400 text-sm mb-6">
          If you don&apos;t check out, these people will be able to see your last known location.
          Maximum 3 contacts.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6"
        >
          <h2 className="font-semibold mb-4">Add Contact</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-900/30 border border-emerald-800 text-emerald-300 text-sm p-3 rounded-lg mb-4">
              {success}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Phone *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none"
                placeholder="+1 555 123 4567"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Relationship</label>
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none"
                placeholder="Spouse, Partner, Parent..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting || contacts.length >= 3}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-semibold mt-2"
            >
              {submitting ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          <h2 className="font-semibold text-slate-400 text-sm uppercase tracking-wide">
            {contacts.length} of 3 Contacts
          </h2>

          {loading ? (
            <div className="text-slate-500 text-center py-8">Loading...</div>
          ) : contacts.length === 0 ? (
            <div className="text-slate-600 text-center py-8 border border-dashed border-slate-800 rounded-2xl">
              No emergency contacts yet
            </div>
          ) : (
            contacts.map((contact, i) => (
              <div
                key={contact.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {i === 0 ? '1️⃣' : i === 1 ? '2️⃣' : '3️⃣'}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-100">{contact.name}</p>
                    <p className="text-sm text-slate-400">{contact.phone}</p>
                    {contact.relationship && (
                      <p className="text-xs text-slate-500">{contact.relationship}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(contact.id)}
                  className="text-slate-500 hover:text-red-400 text-sm px-3 py-1 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
