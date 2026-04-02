import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCheckIn,
  getActiveCheckIns,
  getActiveCheckInCount,
  checkOut,
  getAllZoneStats,
  expireOldCheckIns,
} from '@/lib/checkInStore';

// Use vi.hoisted to capture mock refs outside the vi.mock factory
const { prisma } = vi.hoisted(() => {
  const mockCheckIn = {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  };
  return { prisma: { checkIn: mockCheckIn } };
});

vi.mock('@/lib/prisma', () => ({ prisma }));

describe('checkInStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCheckIn', () => {
    it('creates a check-in with correct fields', async () => {
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
      prisma.checkIn.create.mockResolvedValueOnce({
        id: 'uuid-123',
        zoneId: 'uac-salt-lake',
        partnerCode: null,
        checkedInAt: new Date(),
        expiresAt,
        status: 'active',
      });

      const result = await createCheckIn({
        zoneId: 'uac-salt-lake',
        expiresAt,
      });

      expect(result.zoneId).toBe('uac-salt-lake');
      expect(result.status).toBe('active');
      expect(prisma.checkIn.create).toHaveBeenCalledTimes(1);
    });

    it('creates check-in without partner code', async () => {
      const expiresAt = new Date();
      prisma.checkIn.create.mockResolvedValueOnce({
        id: 'uuid-456',
        zoneId: 'caic-vail',
        partnerCode: null,
        checkedInAt: new Date(),
        expiresAt,
        status: 'active',
      });

      const result = await createCheckIn({
        zoneId: 'caic-vail',
        expiresAt,
      });

      expect(result.zoneId).toBe('caic-vail');
    });
  });

  describe('getActiveCheckIns', () => {
    it('returns active check-ins for a zone', async () => {
      const now = new Date();
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
      prisma.checkIn.findMany.mockResolvedValueOnce([
        {
          id: 'uuid-789',
          zoneId: 'uac-salt-lake',
          partnerCode: null,
          checkedInAt: now,
          expiresAt,
          status: 'active',
        },
      ]);

      const result = await getActiveCheckIns('uac-salt-lake');

      expect(result).toHaveLength(1);
      expect(result[0].zoneId).toBe('uac-salt-lake');
      expect(prisma.checkIn.findMany).toHaveBeenCalledWith({
        where: {
          zoneId: 'uac-salt-lake',
          status: 'active',
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { checkedInAt: 'asc' },
      });
    });

    it('returns empty array when no check-ins', async () => {
      prisma.checkIn.findMany.mockResolvedValueOnce([]);

      const result = await getActiveCheckIns('caic-steamboat');

      expect(result).toHaveLength(0);
    });
  });

  describe('getActiveCheckInCount', () => {
    it('returns correct count', async () => {
      prisma.checkIn.count.mockResolvedValueOnce(7);

      const result = await getActiveCheckInCount('uac-salt-lake');

      expect(result).toBe(7);
      expect(prisma.checkIn.count).toHaveBeenCalledWith({
        where: {
          zoneId: 'uac-salt-lake',
          status: 'active',
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('returns 0 when no check-ins', async () => {
      prisma.checkIn.count.mockResolvedValueOnce(0);

      const result = await getActiveCheckInCount('caic-front-range');

      expect(result).toBe(0);
    });
  });

  describe('checkOut', () => {
    it('marks check-in as checked_out', async () => {
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
      prisma.checkIn.update.mockResolvedValueOnce({
        id: 'uuid-123',
        zoneId: 'uac-salt-lake',
        partnerCode: null,
        checkedInAt: new Date(),
        expiresAt,
        status: 'checked_out',
      });

      const result = await checkOut('uuid-123');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('checked_out');
      expect(prisma.checkIn.update).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
        data: { status: 'checked_out' },
      });
    });

    it('throws for non-existent check-in', async () => {
      prisma.checkIn.update.mockRejectedValueOnce(new Error('Record not found'));

      await expect(checkOut('non-existent')).rejects.toThrow('Record not found');
    });
  });

  describe('getAllZoneStats', () => {
    it('returns stats for all active zones', async () => {
      prisma.checkIn.findMany.mockResolvedValueOnce([
        { zoneId: 'uac-salt-lake' },
        { zoneId: 'caic-steamboat' },
      ]);
      prisma.checkIn.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0);

      const result = await getAllZoneStats();

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.zoneId === 'uac-salt-lake')).toEqual({
        zoneId: 'uac-salt-lake',
        activeCount: 5,
        overdueCount: 1,
      });
    });

    it('returns empty array when no active zones', async () => {
      prisma.checkIn.findMany.mockResolvedValueOnce([]);

      const result = await getAllZoneStats();

      expect(result).toHaveLength(0);
    });
  });

  describe('expireOldCheckIns', () => {
    it('expires old check-ins and returns count', async () => {
      prisma.checkIn.updateMany.mockResolvedValueOnce({ count: 4 });

      const result = await expireOldCheckIns();

      expect(result).toBe(4);
      expect(prisma.checkIn.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'expired' },
      });
    });

    it('returns 0 when no check-ins to expire', async () => {
      prisma.checkIn.updateMany.mockResolvedValueOnce({ count: 0 });

      const result = await expireOldCheckIns();

      expect(result).toBe(0);
    });
  });
});
