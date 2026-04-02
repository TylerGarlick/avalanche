'use client';

import { useEffect, useState } from 'react';

interface ExpiredCheckIn {
  id: string;
  zoneName: string;
  expiresAt: string;
}

export function useEscalationCheck(): ExpiredCheckIn | null {
  const [expiredCheckIn, setExpiredCheckIn] = useState<ExpiredCheckIn | null>(null);

  useEffect(() => {
    // Only check on mount
    const checkEscalation = async () => {
      try {
        const res = await fetch('/api/check-in');
        if (!res.ok) return;

        const data = await res.json();
        if (!data.checkIn) return;

        const checkIn = data.checkIn;

        // Only alert if status is 'active' and past expiresAt + 30 min
        if (checkIn.status === 'active') {
          const expiresAt = new Date(checkIn.expiresAt);
          const now = new Date();
          const thirtyMin = 30 * 60 * 1000;

          if (now.getTime() - expiresAt.getTime() > thirtyMin) {
            // Get zone name from localStorage or default
            const zoneName =
              localStorage.getItem('lastCheckedInZone') ||
              `Zone ${checkIn.zoneId}`;

            setExpiredCheckIn({
              id: checkIn.id,
              zoneName,
              expiresAt: checkIn.expiresAt,
            });
          }
        }
      } catch {
        // Silently fail — not critical
      }
    };

    checkEscalation();
  }, []);

  return expiredCheckIn;
}
