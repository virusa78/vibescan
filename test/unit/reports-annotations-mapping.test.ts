import { describe, expect, it } from '@jest/globals';
import { mapAcceptanceToAnnotationState } from '../../wasp-app/src/server/operations/reports/annotations';

describe('mapAcceptanceToAnnotationState', () => {
  it('maps accepted without expiry to accepted', () => {
    const result = mapAcceptanceToAnnotationState({
      status: 'accepted',
      expiresAt: null,
      now: new Date('2026-04-22T00:00:00.000Z'),
    });

    expect(result).toBe('accepted');
  });

  it('maps accepted with future expiry to snoozed', () => {
    const result = mapAcceptanceToAnnotationState({
      status: 'accepted',
      expiresAt: new Date('2026-04-23T00:00:00.000Z'),
      now: new Date('2026-04-22T00:00:00.000Z'),
    });

    expect(result).toBe('snoozed');
  });

  it('maps accepted with past expiry to expired', () => {
    const result = mapAcceptanceToAnnotationState({
      status: 'accepted',
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      now: new Date('2026-04-22T00:00:00.000Z'),
    });

    expect(result).toBe('expired');
  });

  it('maps revoked to rejected', () => {
    const result = mapAcceptanceToAnnotationState({
      status: 'revoked',
      expiresAt: null,
      now: new Date('2026-04-22T00:00:00.000Z'),
    });

    expect(result).toBe('rejected');
  });
});
