import { describe, expect, it } from 'vitest';
import {
  buildGrantProfilePatch,
  buildRevokeProfilePatch,
  expiresAtFromDays,
  isAdminProfile,
  resolveAdminRowStatus,
} from './adminAccess';

const FIXED = new Date('2026-09-10T12:00:00.000Z');

describe('expiresAtFromDays', () => {
  it('returns null for unlimited', () => {
    expect(expiresAtFromDays(null, FIXED)).toBeNull();
  });

  it('adds exact days for 30/45/90', () => {
    expect(expiresAtFromDays(30, FIXED)).toBe('2026-10-10T12:00:00.000Z');
    expect(expiresAtFromDays(45, FIXED)).toBe('2026-10-25T12:00:00.000Z');
    expect(expiresAtFromDays(90, FIXED)).toBe('2026-12-09T12:00:00.000Z');
  });
});

describe('buildGrantProfilePatch / buildRevokeProfilePatch', () => {
  it('grant sets manual_preview + active + expiry', () => {
    expect(buildGrantProfilePatch(45, FIXED)).toEqual({
      access_mode: 'manual_preview',
      is_active: true,
      access_expires_at: '2026-10-25T12:00:00.000Z',
      updated_at: FIXED.toISOString(),
    });
  });

  it('revoke clears access', () => {
    expect(buildRevokeProfilePatch(FIXED)).toEqual({
      access_mode: 'lite_disabled',
      is_active: false,
      access_expires_at: null,
      updated_at: FIXED.toISOString(),
    });
  });
});

describe('isAdminProfile / resolveAdminRowStatus', () => {
  it('detects admin by role or internal_admin', () => {
    expect(isAdminProfile({ role: 'admin', access_mode: 'billing_managed' })).toBe(true);
    expect(isAdminProfile({ role: 'user', access_mode: 'internal_admin' })).toBe(true);
    expect(isAdminProfile({ role: 'user', access_mode: 'manual_preview' })).toBe(false);
  });

  it('marks expired when is_active but past expiry', () => {
    expect(
      resolveAdminRowStatus(
        {
          role: 'user',
          access_mode: 'manual_preview',
          is_active: true,
          access_expires_at: '2026-09-01T00:00:00.000Z',
        },
        FIXED,
      ),
    ).toBe('expired');
  });

  it('marks active when unlimited', () => {
    expect(
      resolveAdminRowStatus(
        {
          role: 'user',
          access_mode: 'manual_preview',
          is_active: true,
          access_expires_at: null,
        },
        FIXED,
      ),
    ).toBe('active');
  });
});
