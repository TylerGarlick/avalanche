'use client';

import { useEscalationCheck } from '@/hooks/useEscalationCheck';
import EscalationAlert from '@/components/EscalationAlert';

export default function EscalationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const expiredCheckIn = useEscalationCheck();

  if (expiredCheckIn) {
    return (
      <EscalationAlert
        expiredCheckIn={expiredCheckIn}
        onResolved={() => window.location.reload()}
      />
    );
  }

  return <>{children}</>;
}
