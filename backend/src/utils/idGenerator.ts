/**
 * Generates a clean, human-readable 9-digit device ID formatted as XXX-XXX-XXX
 */
export const generatePublicDeviceId = (): string => {
  const part1 = Math.floor(100 + Math.random() * 900); // 100..999
  const part2 = Math.floor(100 + Math.random() * 900);
  const part3 = Math.floor(100 + Math.random() * 900);
  return `${part1}-${part2}-${part3}`;
};

/**
 * Normalizes input device ID (strips spaces, dashes, etc.) to standard XXX-XXX-XXX
 */
export const normalizeDeviceId = (input: string): string => {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 9) {
    return input.trim();
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`;
};
