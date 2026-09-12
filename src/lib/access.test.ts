import { describe, expect, it } from 'vitest';
import { canUseCalculator, isAdmin, resolveLiteAccess } from './access';

describe('resolveLiteAccess', () => {
  it('admins are always active', () => {
    expect(resolveLiteAccess({ role: 'admin', isActive: false })).toBe('active');
    expect(resolveLiteAccess({ accessMode: 'internal_admin', isActive: false })).toBe('active');
  });

  it('requires is_active (manual_preview alone is not enough)', () => {
    expect(resolveLiteAccess({ accessMode: 'manual_preview', isActive: false })).toBe('disabled');
    expect(resolveLiteAccess({ accessMode: 'manual_preview', isActive: true })).toBe('active');
    expect(resolveLiteAccess({ accessMode: 'manual_preview' })).toBe('pending');
  });

  it('respects lite_disabled and expiry', () => {
    expect(resolveLiteAccess({ isActive: true, accessMode: 'lite_disabled' })).toBe('disabled');
    expect(
      resolveLiteAccess({
        isActive: true,
        accessExpiresAt: '2020-01-01T00:00:00.000Z',
      }),
    ).toBe('disabled');
  });

  it('unlimited active when is_active and no expiry', () => {
    expect(resolveLiteAccess({ isActive: true, accessExpiresAt: null })).toBe('active');
  });
});

describe('canUseCalculator / isAdmin', () => {
  it('only active can calculate', () => {
    expect(canUseCalculator('active')).toBe(true);
    expect(canUseCalculator('pending')).toBe(false);
    expect(canUseCalculator('disabled')).toBe(false);
  });

  it('active user is not admin', () => {
    expect(isAdmin({ role: 'user', accessMode: 'manual_preview', isActive: true })).toBe(false);
  });
});
