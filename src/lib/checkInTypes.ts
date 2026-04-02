// ============================================================
// Avalanche Check-In — Data Types
// Privacy-first, anonymous, patrol-focused
// ============================================================

export type CheckInStatus = 'active' | 'checked_out' | 'overdue';

export interface CheckIn {
  id: string;
  zoneId: string;
  checkedInAt: Date;
  expiresAt: Date; // Auto-checkout after X hours
  partnerToken?: string; // Optional: link to partner group
  status: CheckInStatus;
}

export interface PartnerGroup {
  token: string; // Shared secret — partners use the same token
  memberIds: [string, string]; // Two check-in IDs
  checkedInAt: Date;
  checkedOutAt?: Date;
  mismatchAlertSent: boolean;
}

export interface PatrolZoneView {
  zoneId: string;
  zoneName: string;
  activeCount: number;
  overdueCount: number;
  dangerRating: 1 | 2 | 3 | 4 | 5;
  densityStatus: 'low' | 'moderate' | 'high' | 'critical';
  lastUpdated: Date;
}

export interface DensityAlert {
  id: string;
  zoneId: string;
  triggerType: 'count' | 'partner_mismatch' | 'overdue';
  message: string;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

// Density thresholds — customizable per danger level
export const DENSITY_THRESHOLDS: Record<1 | 2 | 3 | 4 | 5, { moderate: number; high: number; critical: number }> = {
  1: { moderate: 20, high: 40, critical: 60 },
  2: { moderate: 15, high: 30, critical: 50 },
  3: { moderate: 10, high: 20, critical: 35 },
  4: { moderate: 5, high: 10, critical: 20 },
  5: { moderate: 3, high: 6, critical: 12 },
};

export const DEFAULT_CHECK_IN_DURATION_HOURS = 6;
export const OVERDUE_HOURS_AFTER_EXPIRY = 2;
