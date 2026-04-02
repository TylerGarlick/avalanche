import { describe, it, expect } from 'vitest';
import {
  DENSITY_THRESHOLDS,
  DEFAULT_CHECK_IN_DURATION_HOURS,
  OVERDUE_HOURS_AFTER_EXPIRY,
} from '@/lib/checkInTypes';

import type {
  CheckInStatus,
  CheckIn,
  PartnerGroup,
  PatrolZoneView,
  DensityAlert,
} from '@/lib/checkInTypes';

describe('checkInTypes', () => {
  describe('types are exported', () => {
    it('CheckInStatus is a union type', () => {
      const statuses: CheckInStatus[] = ['active', 'checked_out', 'overdue'];
      expect(statuses).toHaveLength(3);
    });

    it('CheckIn interface has required fields', () => {
      const checkIn: CheckIn = {
        id: 'test-123',
        zoneId: 'uac-salt-lake',
        partnerCode: null,
        checkedInAt: new Date(),
        expiresAt: new Date(),
        status: 'active',
      };
      expect(checkIn.id).toBe('test-123');
      expect(checkIn.zoneId).toBe('uac-salt-lake');
      expect(checkIn.status).toBe('active');
    });

    it('PartnerGroup interface works', () => {
      const group: PartnerGroup = {
        code: 'ABC12345',
        members: ['id-1', 'id-2'],
        createdAt: new Date(),
      };
      expect(group.code).toBe('ABC12345');
      expect(group.members).toHaveLength(2);
    });

    it('PatrolZoneView interface works', () => {
      const view: PatrolZoneView = {
        zoneId: 'uac-provo',
        activeCount: 12,
        densityStatus: 'moderate',
        overdueCount: 0,
      };
      expect(view.zoneId).toBe('uac-provo');
      expect(view.activeCount).toBe(12);
      expect(view.densityStatus).toBe('moderate');
    });

    it('DensityAlert interface works', () => {
      const alert: DensityAlert = {
        zoneId: 'caic-vail',
        level: 'high',
        count: 55,
        message: 'High density alert',
      };
      expect(alert.level).toBe('high');
      expect(alert.count).toBe(55);
    });
  });

  describe('DENSITY_THRESHOLDS', () => {
    it('has thresholds for all 5 danger levels', () => {
      const levels: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];
      for (const level of levels) {
        expect(DENSITY_THRESHOLDS[level]).toHaveProperty('moderate');
        expect(DENSITY_THRESHOLDS[level]).toHaveProperty('high');
        expect(DENSITY_THRESHOLDS[level]).toHaveProperty('critical');
      }
    });

    it('moderate < high < critical for each level', () => {
      for (const level of [1, 2, 3, 4, 5] as const) {
        const t = DENSITY_THRESHOLDS[level];
        expect(t.moderate).toBeLessThan(t.high);
        expect(t.high).toBeLessThan(t.critical);
      }
    });

    it('Level 3 (Considerable) has moderate=10, high=20, critical=35', () => {
      const t = DENSITY_THRESHOLDS[3];
      expect(t.moderate).toBe(10);
      expect(t.high).toBe(20);
      expect(t.critical).toBe(35);
    });
  });

  describe('DEFAULT_CHECK_IN_DURATION_HOURS', () => {
    it('is 6 hours', () => {
      expect(DEFAULT_CHECK_IN_DURATION_HOURS).toBe(6);
    });
  });

  describe('OVERDUE_HOURS_AFTER_EXPIRY', () => {
    it('is 2 hours', () => {
      expect(OVERDUE_HOURS_AFTER_EXPIRY).toBe(2);
    });
  });
});
