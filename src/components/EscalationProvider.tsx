'use client';

import { useEscalationCheck } from '@/hooks/useEscalationCheck';
import EscalationAlert from '@/components/EscalationAlert';

export default function EscalationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isEscalated, checkIn, dismiss } = useEscalationCheck();

  if (isEscalated && checkIn) {
    return (
      <EscalationAlert
        expiredCheckIn={checkIn}
        onResolved={dismiss}
      />
    );
  }

  return <>{children}</>;
}
