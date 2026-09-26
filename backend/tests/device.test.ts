import { describe, it, expect } from 'vitest';
import { generatePublicDeviceId, normalizeDeviceId } from '../src/utils/idGenerator.js';

describe('Device ID Utilities', () => {
  it('should generate a 9-digit formatted device ID (XXX-XXX-XXX)', () => {
    const id = generatePublicDeviceId();
    expect(id).toMatch(/^\d{3}-\d{3}-\d{3}$/);
  });

  it('should normalize formatted or unformatted 9-digit inputs', () => {
    expect(normalizeDeviceId('489123789')).toBe('489-123-789');
    expect(normalizeDeviceId('489 123 789')).toBe('489-123-789');
    expect(normalizeDeviceId('489-123-789')).toBe('489-123-789');
    expect(normalizeDeviceId('  489 123 789 ')).toBe('489-123-789');
  });
});
