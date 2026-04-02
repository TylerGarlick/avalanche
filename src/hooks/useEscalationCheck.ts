'use client';

import { useState, useEffect } from 'react';

export interface CheckIn {
  id: string;
  zoneId: string;
  checkedInAt: string;
  expiresAt: string;
  status: string;
}

const ESCALATION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes past expiry
const DISMISSAL_KEY = 'escalation-dismissed';

interface UseEscalationCheckReturn {
  isEscalated: boolean;
  checkIn: CheckIn | null;
  dismiss: () => void;
}

export function useEscalationCheck(): UseEscalationCheckReturn {
  const [isEscalated, setIsEscalated] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);

  useEffect(() => {
    async function checkEscalation() {
      try {
        const res = await fetch('/api/check-in/active');
        if (!res.ok) return;

        const data = await res.json();
        if (!data.checkIn) return;

        const cb: CheckIn = {
          id: data.checkIn.id,
          zoneId: data.checkIn.zoneId,
          checkedInAt: data.checkIn.checkedInAt,
          expiresAt: data.checkIn.expiresAt,
          status: data.checkIn.status,
        };

        setCheckIn(cb);

        const expiresAt = new Date(cb.expiresAt).getTime();
        const now = Date.now();
        const elapsedPastExpiry = now - expiresAt;

        if (elapsedPastExpiry < ESCALATION_THRESHOLD_MS) return;

        // Check if dismissed for this check-in
        const dismissed = localStorage.getItem(DISMISSAL_KEY);
        if (dismissed) {
          const { checkInId, timestamp } = JSON.parse(dismissed);
          if (checkInId === cb.id && now - timestamp < ESCALATION_THRESHOLD_MS * 2) {
            return;
          }
        }

        setIsEscalated(true);
      } catch (err) {
        console.error('Escalation check failed:', err);
      }
    }

    checkEscalation();
  }, []);

  function dismiss() {
    if (checkIn) {
      localStorage.setItem(
        DISMISSAL_KEY,
        JSON.stringify({ checkInId: checkIn.id, timestamp: Date.now() })
      );
    }
    setIsEscalated(false);
  }

  return { isEscalated, checkIn, dismiss };
}
