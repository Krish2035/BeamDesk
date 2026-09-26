import { describe, it, expect } from 'vitest';
import { formatDeviceId, normalizeDeviceId } from '../utils/format.js';

describe('Frontend Formatting Utilities', () => {
  it('formats raw digits into 3x3 spaced device ID', () => {
    expect(formatDeviceId('489123789')).toBe('489 123 789');
  });

  it('normalizes formatted strings into dashed format', () => {
    expect(normalizeDeviceId('489 123 789')).toBe('489-123-789');
    expect(normalizeDeviceId('489-123-789')).toBe('489-123-789');
  });
});
